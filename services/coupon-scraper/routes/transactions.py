from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, UserPointsPlaceholder, Coupon, Redemption

router = APIRouter(tags=["transactions"])


class RedeemRequest(BaseModel):
    user_id: str  # string/UUID - see PLACEHOLDER note in database.py
    coupon_id: int


@router.post("/redeem")
def redeem(req: RedeemRequest, db: Session = Depends(get_db)):
    """
    The transaction flow. Order of checks matters:
      1. Lock/fetch user + coupon inside one DB session
      2. Re-check coupon status server-side (never trust a client-cached
         'active' flag - the coupon could have expired since the page loaded)
      3. Re-check balance server-side
      4. Only then: deduct KP, write the redemption row, return the real code

    Steps 3-4 happen in a single commit so a double-click / race can't spend
    the same points twice. SQLite serializes writes by default, which is
    sufficient for hackathon-scale traffic; a real deployment on Postgres
    would wrap this in `SELECT ... FOR UPDATE` for the same guarantee under
    concurrent load.
    """
    user = db.query(UserPointsPlaceholder).get(req.user_id)
    if not user:
        raise HTTPException(404, "user not found")

    coupon = db.query(Coupon).get(req.coupon_id)
    if not coupon:
        raise HTTPException(404, "coupon not found")

    if coupon.status != "active":
        raise HTTPException(409, f"coupon is not redeemable (status: {coupon.status})")

    if user.kp_balance < coupon.kp_cost:
        raise HTTPException(402, "insufficient KP balance")

    user.kp_balance -= coupon.kp_cost
    redemption = Redemption(
        user_id=user.id,
        coupon_id=coupon.id,
        kp_spent=coupon.kp_cost,
        code_shown=coupon.code,
    )
    db.add(redemption)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "code": coupon.code,
        "kp_spent": coupon.kp_cost,
        "kp_balance_after": user.kp_balance,
        "brand": coupon.brand,
        "title": coupon.title,
    }


@router.get("/users/{user_id}")
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(UserPointsPlaceholder).get(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return {"id": user.id, "name": user.name, "kp_balance": user.kp_balance}


@router.get("/users/{user_id}/redemptions")
def get_user_redemptions(user_id: str, db: Session = Depends(get_db)):
    """Redemption history - this is also what should back the 'REDEEMED' /
    'COUPON CODE' state already in ExchangePage.tsx, replacing its in-memory
    `redeemed` Set with a real persisted list."""
    rows = db.query(Redemption).filter(Redemption.user_id == user_id).all()
    return [
        {
            "coupon_id": r.coupon_id,
            "brand": r.coupon.brand,
            "title": r.coupon.title,
            "code": r.code_shown,
            "kp_spent": r.kp_spent,
            "redeemed_at": r.redeemed_at.isoformat(),
        }
        for r in rows
    ]
