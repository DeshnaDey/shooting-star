from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, RewardItem, CouponCode, PointsLedgerEntry, IS_POSTGRES, STATUS_USED
from auth import get_current_user_id

router = APIRouter(tags=["transactions"])


def _get_user(db: Session, user_id: int) -> User:
    """
    This service shares the SAME `users` table as the main backend (not a
    separate one) - a user only ever has a valid JWT because they already
    registered/logged in through backend, which is what creates the row
    (with email, name, password_hash all required/NOT NULL on that table).

    So this NEVER inserts a new user row - if a valid token points at a
    user_id with no row, that's a real inconsistency to surface as an
    error, not something to paper over by creating an incomplete row
    (doing that previously caused a NOT NULL constraint violation on
    email/name, which this service has no legitimate value for anyway).

    New users start with kp_balance_cached=0 from the migration's column
    default - see scripts/migrate_add_points_columns.py. For giving
    existing users their real historical KP as a one-time starting balance
    (rather than everyone starting at 0), see
    scripts/backfill_initial_points.py - a one-off script, not runtime logic.
    """
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(
            404,
            "user not found - this service doesn't create users; "
            "make sure you're registered/logged in via the main app first",
        )
    return user


class RedeemRequest(BaseModel):
    reward_item_id: int
    # NOTE: user_id is intentionally NOT accepted here anymore - it's taken
    # only from the verified JWT (get_current_user_id), never from the
    # request body. A client can no longer redeem points as a different user
    # by editing this payload.


@router.post("/redeem")
def redeem(
    req: RedeemRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    The transaction flow (docs/PROMPT.md 2.7/2.8):
      1. Load the user (must already exist - see _get_user) and the reward item
      2. Check balance against reward_item.kp_cost
      3. Atomically claim ONE currently-redeemable CouponCode from the pool
         (SELECT ... FOR UPDATE SKIP LOCKED on Postgres, so two concurrent
         redemptions can never claim the same code)
      4. Debit: append a PointsLedgerEntry AND update the cached balance,
         in the same commit
      5. Mark the claimed code 'used', return its actual code
    """
    user = _get_user(db, user_id)

    reward = db.query(RewardItem).get(req.reward_item_id)
    if not reward:
        raise HTTPException(404, "reward not found")
    if reward.kind != "coupon":
        raise HTTPException(400, "this reward is not a coupon-scraper item (likely a cosmetic - redeem via the cosmetics catalog instead)")

    if user.kp_balance_cached < reward.kp_cost:
        raise HTTPException(402, "insufficient KP balance")

    query = db.query(CouponCode).filter(
        CouponCode.reward_item_id == reward.id,
        CouponCode.status == "active",
    )
    if IS_POSTGRES:
        query = query.with_for_update(skip_locked=True)

    claimed_code = None
    for candidate in query.all():
        if candidate.is_currently_redeemable():
            claimed_code = candidate
            break

    if claimed_code is None:
        raise HTTPException(409, "out of stock - no currently-valid codes available for this reward")

    user.kp_balance_cached -= reward.kp_cost
    db.add(PointsLedgerEntry(
        user_id=user.id,
        delta=-reward.kp_cost,
        reason=f"Redeemed: {reward.name}",
        ref_type="reward_redemption",
        ref_id=str(claimed_code.id),
    ))
    claimed_code.status = STATUS_USED

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "code": claimed_code.code,
        "kp_spent": reward.kp_cost,
        "kp_balance_after": user.kp_balance_cached,
        "brand": reward.brand,
        "title": reward.name,
    }


@router.get("/me/points")
def get_my_points(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """Renamed from /users/{user_id} - a user can now only ever read their
    OWN balance (derived from their own verified token), never anyone
    else's by guessing an id in the URL."""
    user = _get_user(db, user_id)
    return {"id": user.id, "kp_balance": user.kp_balance_cached}


@router.get("/me/redemptions")
def get_my_redemptions(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """Redemption history, reconstructed from the points ledger (the source
    of truth) joined back to what was claimed."""
    entries = (
        db.query(PointsLedgerEntry)
        .filter(PointsLedgerEntry.user_id == user_id, PointsLedgerEntry.ref_type == "reward_redemption")
        .order_by(PointsLedgerEntry.created_at.desc())
        .all()
    )
    results = []
    for entry in entries:
        code = db.query(CouponCode).get(int(entry.ref_id)) if entry.ref_id else None
        results.append({
            "reward_item_id": code.reward_item_id if code else None,
            "brand": code.reward_item.brand if code else None,
            "title": code.reward_item.name if code else entry.reason,
            "code": code.code if code else None,
            "kp_spent": -entry.delta,
            "redeemed_at": entry.created_at.isoformat(),
        })
    return results
