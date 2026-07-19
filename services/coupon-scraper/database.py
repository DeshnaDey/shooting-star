"""
Database layer: Postgres (Supabase) via SQLAlchemy, matching the shared
DATABASE_URL used by the rest of the shooting-star project.

Tables:
  coupons      - scraped coupon records, with computed non-expiry status
  redemptions  - transaction log: one row per successful redemption

IMPORTANT - shared database: this service does NOT define its own `users`
table. Points/user accounts almost certainly already exist as part of the
shared schema (see packages/shared-types and docs/PROMPT.md - check there
before running this against the real DB). `user_id` below is left as a
plain string/UUID column so it can reference whatever the real users table
uses as its primary key, rather than assuming an integer id.

Falls back to a local SQLite file if DATABASE_URL isn't set, so this is
still runnable standalone for local dev/testing without touching the shared
Supabase instance.
"""
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()  # reads services/coupon-scraper/.env if present

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./constellation.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# A coupon scraped more than this many days ago, with no explicit expiry date
# on the source page, is treated as "needs re-verification" rather than shown
# as confidently available. Tune this per-source based on how often it churns.
STALE_AFTER_DAYS = 14


# PLACEHOLDER - this table almost certainly duplicates a real users/points
# table that lives in the shared schema (owned by whoever built auth /
# the quiz portal - check packages/shared-types + docs/PROMPT.md). It's kept
# here, under a distinct table name, so this service is runnable and testable
# on its own before that's confirmed. Once the real table/column names are
# known, either point the queries in routes/transactions.py at that table
# directly, or drop this table and have the caller pass the current balance
# in on each request instead of this service owning it.
class UserPointsPlaceholder(Base):
    __tablename__ = "coupon_scraper_user_points_placeholder"

    id = Column(String, primary_key=True)  # string so int-as-string or UUID both work
    name = Column(String, nullable=False)
    kp_balance = Column(Integer, nullable=False, default=0)


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True)
    brand = Column(String, nullable=False)
    title = Column(String, nullable=False)
    detail = Column(String, default="")
    code = Column(String, nullable=False)
    category = Column(String, default="")
    kp_cost = Column(Integer, nullable=False)

    source_name = Column(String, nullable=False)      # e.g. "brand-site", "couponhub"
    source_url = Column(String, nullable=False)

    expires_at = Column(DateTime, nullable=True)       # parsed from source page, if shown
    scraped_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_verified_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    is_redeemed_out = Column(Boolean, default=False)   # source explicitly marked "sold out"/used up
    manually_disabled = Column(Boolean, default=False)  # kill switch for a bad coupon

    redemptions = relationship("Redemption", back_populates="coupon")

    @property
    def status(self) -> str:
        """Computed non-expiry status. Never trust a stored 'active' flag directly —
        recompute from timestamps every time so stale rows can't silently linger."""
        if self.manually_disabled or self.is_redeemed_out:
            return "unavailable"
        now = datetime.utcnow()
        if self.expires_at is not None and self.expires_at < now:
            return "expired"
        if self.expires_at is None and self.last_verified_at < now - timedelta(days=STALE_AFTER_DAYS):
            return "needs_reverification"
        return "active"

    def to_dict(self):
        return {
            "id": self.id,
            "brand": self.brand,
            "title": self.title,
            "detail": self.detail,
            "category": self.category,
            "kp_cost": self.kp_cost,
            "source_name": self.source_name,
            "status": self.status,
            "verified_hours_ago": round(
                (datetime.utcnow() - self.last_verified_at).total_seconds() / 3600, 1
            ),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            # code is intentionally NOT included in list responses - see routes/coupons.py
        }


class Redemption(Base):
    __tablename__ = "redemptions"

    id = Column(Integer, primary_key=True)
    # No FK here on purpose: the real user id type/table isn't confirmed yet
    # (see PLACEHOLDER note above). Stored as string so it works whether the
    # real schema uses int ids or Supabase-style UUIDs.
    user_id = Column(String, nullable=False)
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=False)
    kp_spent = Column(Integer, nullable=False)
    code_shown = Column(String, nullable=False)
    redeemed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    coupon = relationship("Coupon", back_populates="redemptions")


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
