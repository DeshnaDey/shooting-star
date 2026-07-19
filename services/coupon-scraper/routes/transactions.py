from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, RewardItem, CouponCode, PointsLedgerEntry, IS_POSTGRES, STATUS_USED

router = APIRouter(tags=["transactions"])


class RedeemRequest(BaseModel):
    user_id: int
    reward_item_id: int


@router.post("/redeem")
def redeem(req: RedeemRequest, db: Session = Depends(get_db)):
    """
    The transaction flow (docs/PROMPT.md 2.7/2.8):
      1. Load the user and reward item
      2. Check balance against reward_item.kp_cost
      3. Atomically claim ONE currently-redeemable CouponCode from the pool
         (SELECT ... FOR UPDATE SKIP LOCKED on Postgres, so two concurrent
         redemptions can never claim the same code)
      4. Debit: append a PointsLedgerEntry AND update the cached balance,
         in the same commit
      5. Mark the claimed code 'used', return its actual code

    Points are an append-only ledger per spec - this endpoint only ever
    INSERTs into points_ledger, never edits/deletes existing rows. The
    cached balance on User is kept in sync as a read-optimization, updated
    in the same transaction as the ledger insert so they can't drift.
    """
    user = db.query(User).get(req.user_id)
    if not user:
        raise HTTPException(404, "user not found - this service does not create users")

    reward = db.query(RewardItem).get(req.reward_item_id)
    if not reward:
        raise HTTPException(404, "reward not found")
    if reward.kind != "coupon":
        raise HTTPException(400, "this reward is not a coupon-scraper item (likely a cosmetic - redeem via the cosmetics catalog instead)")

    if user.kp_balance_cached < reward.kp_cost:
        raise HTTPException(402, "insufficient KP balance")

    # Claim one redeemable code from the pool. FOR UPDATE SKIP LOCKED means
    # if two requests race for the last code, the loser simply doesn't see
    # it (moves to the next candidate or comes up empty) rather than
    # blocking or double-claiming it.
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


@router.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return {"id": user.id, "name": user.name, "kp_balance": user.kp_balance_cached}


@router.get("/users/{user_id}/redemptions")
def get_user_redemptions(user_id: int, db: Session = Depends(get_db)):
    """Redemption history, reconstructed from the points ledger (the source
    of truth) joined back to what was claimed - this is what should back the
    'REDEEMED' / 'COUPON CODE' state in ExchangePage.tsx."""
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
