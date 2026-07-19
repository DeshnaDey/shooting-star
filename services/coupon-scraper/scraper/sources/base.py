"""
Every coupon source (a specific site, or a specific brand's deals page) is
a small adapter implementing `fetch() -> list[RawCoupon]`.

To add a new source:
  1. Copy example_source.py
  2. Point FETCH_URL at the real page
  3. Rewrite `parse_html()` for that page's actual DOM structure
  4. Register it in scraper/runner.py's SOURCES list

This keeps site-specific scraping logic (which breaks constantly as pages
change) isolated from everything downstream: DB writes, expiry logic, the API.
"""
from abc import ABC, abstractmethod
from typing import List
import httpx
from scraper.parser import RawCoupon

# A real browser UA avoids being trivially blocked by basic bot filters.
# For JS-rendered sites you'd swap httpx for Playwright - see README.
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


class SourceAdapter(ABC):
    source_name: str

    def fetch_html(self, url: str) -> str:
        with httpx.Client(headers=DEFAULT_HEADERS, follow_redirects=True, timeout=15) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text

    @abstractmethod
    def fetch(self) -> List[RawCoupon]:
        """Return every coupon currently listed by this source. Called on
        every scrape run - implementations should be safe to call repeatedly."""
        raise NotImplementedError
