# services/coupon-scraper

Standalone service that periodically searches the web for coupon/promo codes, validates and deduplicates them, and writes verified codes + freshness timestamps into Postgres for the rewards/exchange feature.

Runs on a schedule (Celery beat / cron), not on the request path — the API only ever reads from the pre-scraped, pre-validated table.

See /docs/PROMPT.md, section 'Points & Rewards Exchange'.
