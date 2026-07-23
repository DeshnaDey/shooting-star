"""
Reference adapter. Demonstrates the full parse path (brand/title/code/expiry/
status) against scraper/fixtures/sample_coupons.html so the pipeline is fully
testable without live network access.

To point this at a REAL site instead of the fixture:
  1. Set FETCH_URL to the real listing page
  2. Set USE_LIVE = True
  3. Update the CSS selectors in parse_html() to match that page's actual DOM
     (open devtools on the real page and check - every coupon site's markup
     is different, so the selectors below are illustrative, not universal)

For sites that render coupons via JavaScript (most modern ones do), httpx
alone won't see them - swap fetch_html() for Playwright:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url)
        html = page.content()
"""
import os
from pathlib import Path
from typing import List
from bs4 import BeautifulSoup

from scraper.sources.base import SourceAdapter
from scraper.parser import RawCoupon, looks_expired_or_used

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "sample_coupons.html"
FETCH_URL = "https://example-coupon-site.invalid/deals"  # placeholder - replace with a real URL
USE_LIVE = False  # flip to True once FETCH_URL points somewhere real


class ExampleSource(SourceAdapter):
    source_name = "brand-deals-demo"

    def fetch(self) -> List[RawCoupon]:
        html = self.fetch_html(FETCH_URL) if USE_LIVE else FIXTURE_PATH.read_text()
        return self.parse_html(html)

    def parse_html(self, html: str) -> List[RawCoupon]:
        soup = BeautifulSoup(html, "html.parser")
        coupons = []

        for card in soup.select(".coupon-card"):
            brand = card.select_one(".brand").get_text(strip=True)
            title = card.select_one(".offer-title").get_text(strip=True)
            detail = card.select_one(".offer-detail").get_text(strip=True)
            code = card.select_one(".code").get_text(strip=True)
            category = card.select_one(".category").get_text(strip=True)
            expiry_text = card.select_one(".expiry").get_text(strip=True)
            status_text = card.select_one(".status").get_text(strip=True)

            if not code:
                continue  # no redeemable code, nothing to store

            coupons.append(RawCoupon(
                brand=brand,
                title=title,
                detail=detail,
                code=code,
                category=category,
                source_name=self.source_name,
                source_url=FETCH_URL,
                raw_expiry_text=expiry_text or None,
                looks_redeemed_out=looks_expired_or_used(status_text),
            ))

        return coupons
