"""
Cashback Vouchers - this service's OWN internal reward mechanic, not scraped
from anywhere external. Unlike coupon-kind rewards (real codes found on real
sites), these are self-issued "scratchcard" tiers: spend KP, reveal a real
INR cashback amount. Honest distinction worth keeping clear: coupon = found
externally, voucher = designed internally as part of the points economy.

10 tiers, scaled KP cost roughly matching cashback value. A couple are
given a near-term expiry so "expiring soon" has real data to show.

Usage: python -m scraper.seed_vouchers
"""
from datetime import datetime, timedelta
from database import SessionLocal, RewardItem, CouponCode, init_db, STATUS_ACTIVE

VOUCHER_TIERS = [
    {"name": "Bronze Scratchcard",   "cashback": "₹10–₹50 cashback",   "kp_cost": 150,  "days_until_expiry": None},
    {"name": "Bronze Scratchcard II","cashback": "₹10–₹50 cashback",   "kp_cost": 150,  "days_until_expiry": None},
    {"name": "Silver Scratchcard",   "cashback": "₹50–₹100 cashback",  "kp_cost": 300,  "days_until_expiry": None},
    {"name": "Silver Scratchcard II","cashback": "₹50–₹100 cashback",  "kp_cost": 300,  "days_until_expiry": 6},
    {"name": "Gold Scratchcard",     "cashback": "₹100–₹200 cashback", "kp_cost": 550,  "days_until_expiry": None},
    {"name": "Gold Scratchcard II",  "cashback": "₹100–₹200 cashback", "kp_cost": 550,  "days_until_expiry": None},
    {"name": "Platinum Scratchcard", "cashback": "₹200–₹350 cashback", "kp_cost": 900,  "days_until_expiry": None},
    {"name": "Diamond Scratchcard",  "cashback": "₹350–₹500 cashback", "kp_cost": 1300, "days_until_expiry": 3},
    {"name": "Diamond Scratchcard II","cashback": "₹350–₹500 cashback","kp_cost": 1300, "days_until_expiry": None},
    {"name": "Supernova Scratchcard","cashback": "₹500–₹1000 cashback","kp_cost": 2000, "days_until_expiry": None},
]


def run():
    init_db()
    db = SessionLocal()
    now = datetime.utcnow()
    created, updated = 0, 0

    for i, tier in enumerate(VOUCHER_TIERS, start=1):
        reward_item = (
            db.query(RewardItem)
            .filter(RewardItem.brand == "Shooting Star", RewardItem.name == tier["name"])
            .first()
        )
        if not reward_item:
            reward_item = RewardItem(
                kind="voucher",
                name=tier["name"],
                detail=f"Scratch to reveal: {tier['cashback']}",
                kp_cost=tier["kp_cost"],
                brand="Shooting Star",
                category="cashback",
            )
            db.add(reward_item)
            db.flush()
            created += 1

        code = f"SCRATCH-{i:03d}-{tier['kp_cost']}"
        expires_at = (
            now + timedelta(days=tier["days_until_expiry"])
            if tier["days_until_expiry"] is not None else None
        )
        existing = (
            db.query(CouponCode)
            .filter(CouponCode.reward_item_id == reward_item.id, CouponCode.code == code)
            .first()
        )
        if existing:
            existing.last_verified_at = now
            existing.expires_at = expires_at
            existing.status = STATUS_ACTIVE
            updated += 1
        else:
            db.add(CouponCode(
                reward_item_id=reward_item.id,
                code=code,
                source="internal-voucher-mechanic",
                status=STATUS_ACTIVE,
                expires_at=expires_at,
                first_seen_at=now,
                last_verified_at=now,
            ))
            created += 1

    db.commit()
    db.close()
    print(f"Done: {created} new, {updated} refreshed.")


if __name__ == "__main__":
    run()
