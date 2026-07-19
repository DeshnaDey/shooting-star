"""
Parsing helpers shared by all source adapters.

Keeping this separate from any one source means adding a new coupon site
is just "write a function that returns RawCoupon objects" - all the fiddly
date-parsing / dedup logic lives here once.
"""
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from dateutil import parser as dateutil_parser

EXPIRED_MARKERS = ("expired", "sold out", "no longer valid", "out of stock")

# Loosely matches things like "Expires 12/31/2026", "Valid until Aug 5",
# "Ends 2026-08-05". Deliberately permissive; dateutil does the real parsing.
EXPIRY_PATTERN = re.compile(
    r"(?:expires?|valid until|ends?|good (?:through|til))\s*[:\-]?\s*([A-Za-z0-9,\/\-\s]+)",
    re.IGNORECASE,
)


@dataclass
class RawCoupon:
    """What a source adapter hands back before it's written to the DB."""
    brand: str
    title: str
    detail: str
    code: str
    category: str
    source_name: str
    source_url: str
    raw_expiry_text: Optional[str] = None
    looks_redeemed_out: bool = False


def parse_expiry(text: Optional[str]) -> Optional[datetime]:
    """Extract a real datetime from messy page text. Returns None if there's
    no parseable expiry - callers then fall back to the freshness window."""
    if not text:
        return None
    match = EXPIRY_PATTERN.search(text)
    candidate = match.group(1).strip() if match else text.strip()
    try:
        return dateutil_parser.parse(candidate, fuzzy=True)
    except (ValueError, OverflowError):
        return None


def looks_expired_or_used(text: str) -> bool:
    """Cheap text-marker check for pages that say EXPIRED / SOLD OUT etc.
    This catches cases the expiry-date parser can't (no date shown at all,
    just a status label)."""
    lowered = text.lower()
    return any(marker in lowered for marker in EXPIRED_MARKERS)


def dedupe_key(coupon: RawCoupon) -> str:
    """Coupons re-scraped every run need a stable identity so we UPDATE
    instead of duplicating rows. Brand+code is a reasonable key; if a source
    reuses codes across offers, extend this with title."""
    return f"{coupon.brand.strip().lower()}::{coupon.code.strip().upper()}"
