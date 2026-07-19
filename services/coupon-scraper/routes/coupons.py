from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Coupon

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.get("")
def list_coupons(db: Session = Depends(get_db)):
    """Public listing. Only returns coupons whose computed status is 'active' -
    expired/stale/sold-out ones are filtered server-side, not just hidden in
    the UI, so a stale code can never be fetched by a client that bypasses
    the frontend. Codes themselves are never included here - see redeem below."""
    coupons = db.query(Coupon).all()
    return [c.to_dict() for c in coupons if c.status == "active"]


@router.get("/{coupon_id}")
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
    coupon = db.query(Coupon).get(coupon_id)
    if not coupon:
        return {"error": "not_found"}, 404
    return coupon.to_dict()
