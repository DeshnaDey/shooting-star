"""Reward catalog endpoints (docs/PROMPT.md 2.8 - "Real-world rewards").
Named coupons.py to match the existing file/route layout; serves RewardItem
rows where kind='coupon'. Cosmetic-kind rewards are a different catalog,
owned elsewhere - not served here."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, RewardItem

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.get("")
def list_rewards(db: Session = Depends(get_db)):
    """Public catalog listing. Availability (in_stock) is computed from the
    live coupon_codes pool, not a stored flag - a reward with zero currently-
    redeemable codes still shows up (so it's not just invisible) but marked
    out of stock, matching the low-stock/out-of-stock behavior in
    docs/PROMPT.md 2.8. Codes themselves are never included here."""
    items = db.query(RewardItem).filter(RewardItem.kind == "coupon").all()
    return [item.to_dict(db) for item in items]


@router.get("/{reward_item_id}")
def get_reward(reward_item_id: int, db: Session = Depends(get_db)):
    item = db.query(RewardItem).get(reward_item_id)
    if not item or item.kind != "coupon":
        return {"error": "not_found"}, 404
    return item.to_dict(db)
