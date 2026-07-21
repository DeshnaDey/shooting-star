import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, RewardItem, CouponCode, PointsLedgerEntry, IS_POSTGRES, STATUS_USED
from auth import get_current_user_id

router = APIRouter(tags=["transactions"])
_bearer = HTTPBearer(auto_error=False)

BACKEND_API_BASE_URL = os.getenv("BACKEND_API_BASE_URL", "http://localhost:8000")


def _bootstrap_user(db: Session, user_id: int, bearer_token: str | None) -> User:
    """
    This service keeps its own spendable-points ledger (see database.py's
    module docstring), separate from the main backend's `kp` figure (which
    is just a live sum(scores), not a spendable balance - see
    backend/app/api/routes.py's /profile endpoint). The two aren't the same
    concept, but a brand-new user shouldn't start at 0 here just because
    they've never redeemed anything before.

    So: the first time this service sees a user_id it doesn't have a local
    row for, it asks the main backend (using the SAME bearer token the
    frontend already sent) what that user's current profile kp is, and uses
    it as this service's starting balance. After that, this service's own
    ledger is authoritative for spending - the backend is only consulted
    once, at first sight of a new user.
    """
    user = db.query(User).get(user_id)
    if user:
        return user

    starting_kp = 0
    if bearer_token:
        try:
            resp = httpx.get(
                f"{BACKEND_API_BASE_URL}/api/profile",
                headers={"Authorization": f"Bearer {bearer_token}"},
                timeout=5,
            )
            if resp.status_code == 200:
                starting_kp = resp.json().get("kp", 0)
        except httpx.HTTPError:
            pass  # backend unreachable - fall back to 0 rather than fail redemption entirely

    user = User(id=user_id, kp_balance_cached=starting_kp)
    db.add(user)
    db.commit()
    db.refresh(user)
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
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    """
    The transaction flow (docs/PROMPT.md 2.7/2.8):
      1. Load the user (bootstrapping from the main backend's live kp on
         first sight, see _bootstrap_user) and the reward item
      2. Check balance against reward_item.kp_cost
      3. Atomically claim ONE currently-redeemable CouponCode from the pool
         (SELECT ... FOR UPDATE SKIP LOCKED on Postgres, so two concurrent
         redemptions can never claim the same code)
      4. Debit: append a PointsLedgerEntry AND update the cached balance,
         in the same commit
      5. Mark the claimed code 'used', return its actual code
    """
    user = _bootstrap_user(db, user_id, creds.credentials if creds else None)

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
def get_my_points(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    """Renamed from /users/{user_id} - a user can now only ever read their
    OWN balance (derived from their own verified token), never anyone
    else's by guessing an id in the URL."""
    user = _bootstrap_user(db, user_id, creds.credentials if creds else None)
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
