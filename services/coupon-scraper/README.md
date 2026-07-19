# services/coupon-scraper

Standalone service that periodically searches the web for coupon/promo codes, validates and deduplicates them, and writes verified codes + freshness timestamps into Postgres for the rewards/exchange feature.

Runs on a schedule (Celery beat / cron), not on the request path — the API only ever reads from the pre-scraped, pre-validated table.

See /docs/PROMPT.md, section 'Points & Rewards Exchange'.

---

## Current status (implementation notes)

> **Architecture note:** the current code in this folder runs the scraper
> in-process (on API startup + an in-process timer via APScheduler), which
> does **not** yet match the cron/Celery-beat design above. This needs to be
> split into two pieces: a standalone scrape job (cron/Celery beat) that
> writes to Postgres, and this API which only reads from that table. Flagging
> so it gets fixed before this is considered done — don't build further on
> top of the in-process scheduler.

### What this replaces in the frontend

`ExchangePage.tsx` currently hardcodes `REWARDS` and `KP_BALANCE`, and shows the
same fake code (`STAR-7F3K-9Q`) for every redemption via local `useState`. This
backend makes all of that real:

| Was (frontend mock)              | Now (this backend)                          |
|-----------------------------------|----------------------------------------------|
| `const REWARDS = [...]` hardcoded | `GET /coupons` - live scraped, filtered      |
| `const KP_BALANCE = 1380`         | `GET /users/1` - real persisted balance      |
| `setRedeemed(...)` (local state)  | `POST /redeem` - real DB transaction         |
| Always shows `STAR-7F3K-9Q`       | Returns the coupon's actual scraped code     |
| No persistence                    | `GET /users/1/redemptions` - real history    |

### Setup

```bash
pip install -r requirements.txt
python seed.py              # creates placeholder demo user (id=1, 1380 KP)
uvicorn main:app --reload --port 8000
```

### Testing without live network

`scraper/sources/example_source.py` reads `scraper/fixtures/sample_coupons.html`
by default (`USE_LIVE = False`), so the whole pipeline — parsing, expiry
detection, dedup, the API, the transaction flow — is testable with zero
external dependencies. Run `python -m scraper.runner` to scrape once and
inspect the DB directly.

### Pointing at a real coupon site

1. Open the real site's deals page in devtools, find the repeating container
   for each coupon.
2. In `scraper/sources/example_source.py`: set `FETCH_URL` to the real URL,
   set `USE_LIVE = True`, and rewrite the CSS selectors in `parse_html()` to
   match that page's actual markup.
3. **If the site renders coupons via JavaScript** (most do), `httpx` won't see
   them — swap `fetch_html()` in `sources/base.py` for Playwright.
   `pip install playwright && playwright install chromium`.
4. Register the new adapter instance in `scraper/runner.py`'s `SOURCES` list.
5. **Check the site's robots.txt / terms of service** before scraping it for
   real.

### How non-expiry is determined (`Coupon.status` in `database.py`)

- `expired` — page showed an explicit expiry date and it's passed
- `unavailable` — page marked it "EXPIRED"/"SOLD OUT" in text, or manually disabled
- `needs_reverification` — no expiry date shown, and not re-scraped within
  `STALE_AFTER_DAYS` (14, tune per-source)
- `active` — everything else

Status is recomputed on every read, never cached. `/redeem` re-checks status
server-side even if a client is holding a stale coupon from an old page load.

### Points/users — NOT YET RECONCILED WITH REAL SCHEMA

This service currently uses a placeholder table
(`coupon_scraper_user_points_placeholder` in `database.py`) instead of a real
users table, because the actual users/points schema wasn't available when
this was written. **Check `/docs/PROMPT.md`'s 'Points & Rewards Exchange'
section and `packages/shared-types` before this goes further** — then point
`routes/transactions.py` at the real table/columns and delete the placeholder.

### KP pricing

`scraper/runner.py: estimate_kp_cost()` is a placeholder heuristic. Replace
once there's a real pricing model.

### Wiring into ExchangePage.tsx

Replace hardcoded `REWARDS` with `GET /coupons`, `KP_BALANCE` with
`GET /users/{id}`, and `handleConfirm()`'s local `setRedeemed` with
`POST /redeem` — response includes the real `code` to show instead of the
hardcoded `STAR-7F3K-9Q`.
