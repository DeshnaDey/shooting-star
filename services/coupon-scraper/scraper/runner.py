"""
Runs every registered source adapter and upserts results into the DB.

Call `run_scrape()` directly for a one-off run, or schedule it (see main.py,
which runs this every 30 min via APScheduler) so listings stay fresh and
last_verified_at keeps moving - that's what keeps non-expiry status accurate
for coupons whose source page never states an explicit expiry date.
"""
from datetime import datetime
from database import SessionLocal, Coupon
from scraper.parser import parse_expiry, dedupe_key
from scraper.sources.example_source import ExampleSource

# Register every source adapter here.
SOURCES = [
    ExampleSource(),
]

# Simple KP pricing heuristic until there's a real economy model:
# cheaper categories cost less, and it scales mildly with implied discount size.
# Replace with something smarter once there's real usage data.
CATEGORY_BASE_KP = {
    "food": 600,
    "entertainment": 2000,
    "tech": 1500,
    "books": 1200,
}
DEFAULT_BASE_KP = 1000


def estimate_kp_cost(category: str) -> int:
    return CATEGORY_BASE_KP.get(category.strip().lower(), DEFAULT_BASE_KP)


def run_scrape() -> dict:
    db = SessionLocal()
    stats = {"seen": 0, "created": 0, "updated": 0, "errors": 0}
    now = datetime.utcnow()

    try:
        for source in SOURCES:
            try:
                raw_coupons = source.fetch()
            except Exception as exc:  # noqa: BLE001 - one bad source shouldn't kill the run
                print(f"[scraper] {source.source_name} failed: {exc}")
                stats["errors"] += 1
                continue

            for raw in raw_coupons:
                stats["seen"] += 1
                key = dedupe_key(raw)
                existing = (
                    db.query(Coupon)
                    .filter(Coupon.brand == raw.brand, Coupon.code == raw.code)
                    .first()
                )
                expires_at = parse_expiry(raw.raw_expiry_text)

                if existing:
                    existing.title = raw.title
                    existing.detail = raw.detail
                    existing.category = raw.category
                    existing.expires_at = expires_at
                    existing.is_redeemed_out = raw.looks_redeemed_out
                    existing.last_verified_at = now  # re-scraped = re-verified, even if unchanged
                    stats["updated"] += 1
                else:
                    db.add(Coupon(
                        brand=raw.brand,
                        title=raw.title,
                        detail=raw.detail,
                        code=raw.code,
                        category=raw.category,
                        kp_cost=estimate_kp_cost(raw.category),
                        source_name=raw.source_name,
                        source_url=raw.source_url,
                        expires_at=expires_at,
                        scraped_at=now,
                        last_verified_at=now,
                        is_redeemed_out=raw.looks_redeemed_out,
                    ))
                    stats["created"] += 1

        db.commit()
    finally:
        db.close()

    print(f"[scraper] run complete: {stats}")
    return stats


if __name__ == "__main__":
    from database import init_db
    init_db()
    run_scrape()
