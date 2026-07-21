"""
Database layer: Postgres (Supabase) via SQLAlchemy, matching the schema in
docs/PROMPT.md section 4 (data model) and section 2.7/2.9 (points ledger,
coupon scraper responsibilities).

Tables owned by this service:
  reward_items  - catalog of redeemable offers (kind='coupon' here; 'cosmetic'
                  items belong to a different, non-scraper-backed catalog)
  coupon_codes  - pool of actual scraped codes under a reward_item

Tables this service READS/WRITES but does not consider itself the source of
truth for (they're shared across the whole app per docs/PROMPT.md section 3 -
apps/api owns auth + the points_engine):
  users              - kp_balance_cached is read to check affordability and
                       written on redemption; full user lifecycle (creation,
                       auth, level, streak) is owned by apps/api.
  points_ledger      - append-only. This service only ever INSERTs a debit
                       row here on redemption; it never mutates existing rows.

Falls back to a local SQLite file if DATABASE_URL isn't set, so this is
still testable standalone. Note: SQLite doesn't support SELECT ... FOR UPDATE
row locking, which the redeem flow uses on Postgres to prevent two users
claiming the same coupon code concurrently - see routes/transactions.py.
"""
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./constellation.db")
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# A coupon code not re-verified within this window is treated as not
# currently redeemable, even if its stored status is still "active" -
# see CouponCode.is_currently_redeemable(). Tune per-source.
STALE_AFTER_DAYS = 14

STATUS_ACTIVE = "active"
STATUS_USED = "used"
STATUS_EXPIRED = "expired"


class User(Base):
    """Minimal mirror of the shared users table (docs/PROMPT.md section 4).
    apps/api is the real owner of this table's lifecycle - this service only
    reads kp_balance_cached and decrements it on redemption. Not creating
    users here; if a user_id doesn't exist yet, that's a real error, not
    something this service should paper over by auto-creating a row."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=True)
    name = Column(String, nullable=True)
    kp_balance_cached = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PointsLedgerEntry(Base):
    """Append-only. Never UPDATE or DELETE a row here - balance is derived
    by summing deltas (or, as here, cached on User and reconciled on write)."""
    __tablename__ = "points_ledger"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    delta = Column(Integer, nullable=False)          # negative for redemption debits
    reason = Column(String, nullable=False)
    ref_type = Column(String, nullable=False)         # e.g. "reward_redemption"
    ref_id = Column(String, nullable=True)             # e.g. the coupon_code id
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class RewardItem(Base):
    """Catalog entry - one row per redeemable offer. This service creates/
    updates 'coupon'-kind rows as it scrapes; 'cosmetic'-kind rows belong to
    a different part of the app and this service should never write them."""
    __tablename__ = "reward_items"

    id = Column(Integer, primary_key=True)
    kind = Column(String, nullable=False, default="coupon")  # "coupon" | "cosmetic"
    name = Column(String, nullable=False)
    detail = Column(String, default="")
    kp_cost = Column(Integer, nullable=False)
    brand = Column(String, nullable=True)
    category = Column(String, nullable=True)

    codes = relationship("CouponCode", back_populates="reward_item")

    def to_dict(self, db):
        available = [c for c in self.codes if c.is_currently_redeemable()]
        most_recent = max((c.last_verified_at for c in available), default=None)
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "detail": self.detail,
            "kp_cost": self.kp_cost,
            "brand": self.brand,
            "category": self.category,
            "in_stock": len(available) > 0,
            "stock_count": len(available),
            "verified_hours_ago": (
                round((datetime.utcnow() - most_recent).total_seconds() / 3600, 1)
                if most_recent else None
            ),
            # actual codes are never included in catalog/list responses -
            # only handed back by POST /redeem after a successful debit
        }


class CouponCode(Base):
    """A single claimable code under a RewardItem. Scraper writes/updates
    these; redemption claims one (status -> used) per successful redeem."""
    __tablename__ = "coupon_codes"

    id = Column(Integer, primary_key=True)
    reward_item_id = Column(Integer, ForeignKey("reward_items.id"), nullable=False)
    code = Column(String, nullable=False)
    source = Column(String, nullable=False)        # which scraper source found it
    status = Column(String, nullable=False, default=STATUS_ACTIVE)
    first_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_verified_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)    # parsed from source page, if shown

    reward_item = relationship("RewardItem", back_populates="codes")

    def is_currently_redeemable(self) -> bool:
        """Never trust `status` alone for listing/redemption eligibility -
        also re-check staleness and any explicit expiry date every time."""
        if self.status != STATUS_ACTIVE:
            return False
        now = datetime.utcnow()
        if self.expires_at is not None and self.expires_at < now:
            return False
        if self.last_verified_at < now - timedelta(days=STALE_AFTER_DAYS):
            return False
        return True


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
