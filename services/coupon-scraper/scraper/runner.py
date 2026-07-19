"""
Runs every registered source adapter and upserts results into the DB.

This is the standalone entrypoint meant to run on a schedule (cron / Celery
beat), independent of the API process - see docs/PROMPT.md 2.9. Run directly:

    python -m scraper.runner

Do NOT import run_scrape() into main.py's request-serving process. The API
should only ever read what this has already written.

Writes into two tables (docs/PROMPT.md section 4):
  RewardItem  - the catalog offer (created once per brand+title, kp_cost set
                only on first creation - a re-scrape shouldn't silently
                change what something costs)
  CouponCode  - the pool of actual codes under that offer (upserted every run
                by (reward_item_id, code); status/last_verified_at updated
                every time so staleness tracking stays accurate)
"""
from datetime import datetime
from database import SessionLocal, RewardItem, CouponCode, STATUS_ACTIVE, STATUS_EXPIRED
from scraper.parser import parse_expiry
from scraper.sources.example_source import ExampleSource

# Register every source adapter here.
SOURCES = [
    ExampleSource(),
]

# Simple KP pricing heuristic until points_engine (apps/api) owns real pricing.
# Only applied when a RewardItem is first created - never overwrites an
# existing price on re-scrape.
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
    stats = {"seen": 0, "reward_items_created": 0, "codes_created": 0, "codes_updated": 0, "errors": 0}
    now = datetime.utcnow()

    try:
        for source in SOURCES:
            try:
                raw_coupons = source.fetch()
            except PermissionError as exc:
                # robots.txt disallowed this source - not a bug, don't retry-spam it
                print(f"[scraper] {source.source_name} skipped (robots.txt): {exc}")
                stats["errors"] += 1
                continue
            except Exception as exc:  # noqa: BLE001 - one bad source shouldn't kill the run
                print(f"[scraper] {source.source_name} failed: {exc}")
                stats["errors"] += 1
                continue

            for raw in raw_coupons:
                stats["seen"] += 1

                reward_item = (
                    db.query(RewardItem)
                    .filter(RewardItem.brand == raw.brand, RewardItem.name == raw.title)
                    .first()
                )
                if not reward_item:
                    reward_item = RewardItem(
                        kind="coupon",
                        name=raw.title,
                        detail=raw.detail,
                        kp_cost=estimate_kp_cost(raw.category),
                        brand=raw.brand,
                        category=raw.category,
                    )
                    db.add(reward_item)
                    db.flush()  # get reward_item.id before creating codes under it
                    stats["reward_items_created"] += 1

                expires_at = parse_expiry(raw.raw_expiry_text)
                status = STATUS_EXPIRED if raw.looks_redeemed_out else STATUS_ACTIVE

                existing_code = (
                    db.query(CouponCode)
                    .filter(CouponCode.reward_item_id == reward_item.id, CouponCode.code == raw.code)
                    .first()
                )
                if existing_code:
                    existing_code.status = status
                    existing_code.expires_at = expires_at
                    existing_code.last_verified_at = now  # re-scraped = re-verified either way
                    stats["codes_updated"] += 1
                else:
                    db.add(CouponCode(
                        reward_item_id=reward_item.id,
                        code=raw.code,
                        source=raw.source_name,
                        status=status,
                        expires_at=expires_at,
                        first_seen_at=now,
                        last_verified_at=now,
                    ))
                    stats["codes_created"] += 1

        db.commit()
    finally:
        db.close()

    print(f"[scraper] run complete: {stats}")
    return stats


if __name__ == "__main__":
    from database import init_db
    init_db()
    run_scrape()
