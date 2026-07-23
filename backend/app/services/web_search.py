"""Web search for topic creation. Keep this the ONLY place that calls the search
provider, so swapping to a keyed provider (Brave/Tavily/SerpAPI) later is a
one-file change."""

from __future__ import annotations

import logging

from duckduckgo_search import DDGS

log = logging.getLogger("shooting-star.web_search")


def search_web(query: str, max_results: int = 5) -> str:
    try:
        results = DDGS().text(query, max_results=max_results)
    except Exception as e:
        log.warning("web search failed for %r: %s", query, e)
        return ""
    if not results:
        return ""
    return "".join(f"{r.get('title', '')}\n{r.get('body', '')}\n" for r in results)
