# services/coupon-scraper

Standalone service that periodically searches the web for coupon/promo codes, validates and deduplicates them, and writes verified codes + freshness timestamps into Postgres for the rewards/exchange feature.

Runs on a schedule (Celery beat / cron), not on the request path — the API only ever reads from the pre-scraped, pre-validated table.

See /docs/PROMPT.md, section 'Points & Rewards Exchange'.

---

## How this maps to docs/PROMPT.md

- **2.7 Points system**: implemented as an append-only `points_ledger` table.
  Redemption only ever INSERTs a debit row — never edits or deletes existing
  ledger rows. `users.kp_balance_cached` is kept in sync in the same
  transaction as a read optimization, not the source of truth.
- **2.8 Rewards Exchange**: `reward_items` is the catalog (what a user browses
  and redeems, kp_cost etc.); `coupon_codes` is the pool of actual codes
  under each `reward_item`. Redeeming claims and marks used exactly one code
  from that pool (`SELECT ... FOR UPDATE SKIP LOCKED` on Postgres, so two
  concurrent redemptions can't claim the same code). A reward item with zero
  currently-valid codes shows as out-of-stock in the catalog rather than
  disappearing.
- **2.9 Coupon scraper**: `scraper/runner.py` is the standalone entrypoint,
  meant to run via cron/Celery beat — **not** imported into `main.py`. The
  API process only reads. Adapters respect `robots.txt` (fails closed if it
  can't be read), rate-limit per domain, and identify via
  `SCRAPER_USER_AGENT` — see `scraper/sources/base.py`.

## Scheduling the scraper

Not wired into infra/ yet since that wasn't specified. Options:

```bash
# cron (every 30 min)
*/30 * * * * cd /path/to/services/coupon-scraper && /path/to/venv/bin/python -m scraper.runner

# Celery beat (if the project's Celery/Redis setup from docs/PROMPT.md
# section 3 is already running):
#   from scraper.runner import run_scrape
#   @celery_app.task
#   def scrape_coupons():
#       run_scrape()
#   beat_schedule = {"scrape-coupons": {"task": "scrape_coupons", "schedule": 1800.0}}
```

## Setup

```bash
pip install -r requirements.txt
python seed.py               # local dev only - creates a demo user (real users come from apps/api)
python -m scraper.runner     # one-off scrape run, populates reward_items + coupon_codes
uvicorn main:app --reload --port 8001
```

## Testing without live network / without a real users table yet

`scraper/sources/example_source.py` reads `scraper/fixtures/sample_coupons.html`
by default (`USE_LIVE = False`), so the full pipeline (parsing, robots.txt
logic, expiry/status handling, dedup, ledger, atomic redemption) is testable
with zero external dependencies and no dependency on apps/api existing yet.
Falls back to local SQLite if `DATABASE_URL` isn't set (note: SQLite doesn't
support row locking, so the `FOR UPDATE SKIP LOCKED` concurrency guard is
Postgres-only — fine for local single-request testing, required for
production).

## Pointing at a real coupon site

1. Check for an official affiliate/coupon API first — docs/PROMPT.md 2.9
   explicitly prefers this over scraping wherever one exists.
2. If scraping is genuinely necessary: check that site's `robots.txt` and
   terms of service allow it. The adapter will refuse to fetch (raises
   `PermissionError`) if robots.txt disallows it or can't be read at all —
   this is intentional, don't bypass it.
3. In `scraper/sources/example_source.py`: set `FETCH_URL` to the real URL,
   set `USE_LIVE = True`, rewrite the CSS selectors in `parse_html()` to
   match that page's actual markup.
4. JS-rendered sites need Playwright instead of `httpx` — see the docstring
   in `example_source.py`.
5. Register the adapter instance in `scraper/runner.py`'s `SOURCES` list.

## Users table

This service does **not** create or manage users — `database.py`'s `User`
model is a minimal read/write mirror of the shared table apps/api owns
(auth, profile, level, streak per docs/PROMPT.md 2.1). If `POST /redeem` is
called with a `user_id` that doesn't exist yet, it 404s rather than silently
creating one — that would be the wrong service to do that in.

## Wiring into ExchangePage.tsx

- Replace hardcoded `REWARDS` → `GET /coupons` (returns `reward_items` where
  kind='coupon', with `in_stock`/`stock_count` computed live)
- Replace `KP_BALANCE` → `GET /users/{id}`
- Replace `handleConfirm()`'s local `setRedeemed` → `POST /redeem
  {user_id, reward_item_id}` — response includes the real claimed `code`
- Replace the in-memory `redeemed` Set → `GET /users/{id}/redemptions`
