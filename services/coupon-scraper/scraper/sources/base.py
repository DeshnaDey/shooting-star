"""
Every coupon source (a specific site, or a specific brand's deals page) is
a small adapter implementing `fetch() -> list[RawCoupon]`.

Legal/compliance requirements (docs/PROMPT.md 2.9 - explicitly a HARD
requirement, not optional):
  - Respect robots.txt for every domain fetched
  - Rate-limit and back off per-domain
  - Identify with a clear user agent (SCRAPER_USER_AGENT)
  - Prefer an official affiliate/coupon API over scraping wherever one exists

To add a new source:
  1. Copy example_source.py
  2. Point FETCH_URL at the real page
  3. Rewrite `parse_html()` for that page's actual DOM structure
  4. Register it in scraper/runner.py's SOURCES list
"""
import os
import time
from abc import ABC, abstractmethod
from typing import List
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
import httpx
from scraper.parser import RawCoupon

SCRAPER_USER_AGENT = os.getenv(
    "SCRAPER_USER_AGENT",
    "ConstellationCouponBot/1.0 (+https://github.com/DeshnaDey/shooting-star; "
    "educational project, contact via repo issues)",
)

# Minimum seconds between requests to the same domain. Per-domain, not
# global, since fetching brand-a.com shouldn't have to wait on a rate limit
# incurred while fetching brand-b.com.
MIN_SECONDS_BETWEEN_REQUESTS_PER_DOMAIN = 3.0

_last_request_at: dict[str, float] = {}
_robots_cache: dict[str, RobotFileParser] = {}


def _domain(url: str) -> str:
    return urlparse(url).netloc


def _robots_allows(url: str, user_agent: str) -> bool:
    domain = _domain(url)
    if domain not in _robots_cache:
        parser = RobotFileParser()
        parser.set_url(f"{urlparse(url).scheme}://{domain}/robots.txt")
        try:
            parser.read()
        except Exception:
            # If robots.txt can't be fetched/parsed, fail closed: don't scrape.
            # A source that can't confirm it's allowed doesn't get scraped.
            print(f"[scraper] could not read robots.txt for {domain} - skipping")
            return False
        _robots_cache[domain] = parser
    return _robots_cache[domain].can_fetch(user_agent, url)


def _respect_rate_limit(url: str):
    domain = _domain(url)
    now = time.monotonic()
    elapsed = now - _last_request_at.get(domain, 0.0)
    wait = MIN_SECONDS_BETWEEN_REQUESTS_PER_DOMAIN - elapsed
    if wait > 0:
        time.sleep(wait)
    _last_request_at[domain] = time.monotonic()


class SourceAdapter(ABC):
    source_name: str

    def fetch_html(self, url: str) -> str:
        if not _robots_allows(url, SCRAPER_USER_AGENT):
            raise PermissionError(
                f"robots.txt disallows fetching {url} for {SCRAPER_USER_AGENT} "
                f"- this source must not be scraped. Look for an official API instead."
            )
        _respect_rate_limit(url)
        headers = {"User-Agent": SCRAPER_USER_AGENT}
        with httpx.Client(headers=headers, follow_redirects=True, timeout=15) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text

    @abstractmethod
    def fetch(self) -> List[RawCoupon]:
        """Return every coupon currently listed by this source. Called on
        every scrape run - implementations should be safe to call repeatedly."""
        raise NotImplementedError
