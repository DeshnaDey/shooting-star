"""
Manually-curated real codes, loaded through the same schema/validation path
as the live scraper (RewardItem + CouponCode), for when there's no time to
build+test a live scraper against a real site's actual DOM before a demo.

This is NOT a scraper - codes here were found and copy-pasted by a human
from real, currently-public promo pages. Still goes through the same
dedup/status logic as scraped data, so the API and redeem flow can't tell
the difference. Mark clearly in team notes that this is manually seeded,
not live-scraped, so nobody mistakes it for the real scraper working later.

Usage: python -m scraper.seed_real_codes
"""
from datetime import datetime, timedelta
from database import SessionLocal, RewardItem, CouponCode, init_db, STATUS_ACTIVE

# Fill in real codes here - brand, title, code, category, detail, optional
# days_until_expiry (None if the source page didn't show an expiry date).
REAL_CODES = [
    {
        "brand": "Zomato",
        "title": "Flat ₹100 off",
        "code": "CHN100YMP",
        "category": "food",
        "detail": "Flat ₹100 off, no minimum order value, valid in all cities, all users",
        "days_until_expiry": None,  # no explicit expiry shown on source - freshness-tracked
    },
    {
        "brand": "Croma",
        "title": "Extra 5% off with card payment",
        "code": "citi",
        "category": "tech",
        "detail": "Extra 5% off electronics when paying by debit/credit card",
        "days_until_expiry": None,
    },
    {
        "brand": "BookMyShow",
        "title": "Top movie ticket discount code",
        "code": "STREAMSAVE",
        "category": "entertainment",
        "detail": "Currently the top-rated discount code for movie ticket bookings",
        "days_until_expiry": None,
    },
    {
        "brand": "Flipkart",
        "title": "50% off sitewide (incl. Books)",
        "code": "FKG50",
        "category": "books",
        "detail": "50% off - sitewide code, applies across Flipkart's Books section and more",
        "days_until_expiry": None,
    },
]

CATEGORY_BASE_KP = {"food": 600, "entertainment": 2000, "tech": 1500, "books": 1200}
DEFAULT_BASE_KP = 1000


def run():
    if not REAL_CODES:
        print("REAL_CODES is empty - add entries to this file first, see the template above.")
        return

    init_db()
    db = SessionLocal()
    now = datetime.utcnow()
    created, updated = 0, 0

    for entry in REAL_CODES:
        reward_item = (
            db.query(RewardItem)
            .filter(RewardItem.brand == entry["brand"], RewardItem.name == entry["title"])
            .first()
        )
        if not reward_item:
            reward_item = RewardItem(
                kind="coupon",
                name=entry["title"],
                detail=entry.get("detail", ""),
                kp_cost=CATEGORY_BASE_KP.get(entry["category"].lower(), DEFAULT_BASE_KP),
                brand=entry["brand"],
                category=entry["category"],
            )
            db.add(reward_item)
            db.flush()

        expires_at = (
            now + timedelta(days=entry["days_until_expiry"])
            if entry.get("days_until_expiry") is not None else None
        )

        existing = (
            db.query(CouponCode)
            .filter(CouponCode.reward_item_id == reward_item.id, CouponCode.code == entry["code"])
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
                code=entry["code"],
                source="manual-seed",
                status=STATUS_ACTIVE,
                expires_at=expires_at,
                first_seen_at=now,
                last_verified_at=now,
            ))
            created += 1

    db.commit()
    db.close()
    print(f"Done: {created} new codes, {updated} refreshed.")


if __name__ == "__main__":
    run()
