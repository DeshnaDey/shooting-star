"""Valid-guess dictionary for the Arcade Wordle game (~10k common 5-letter words).

Served to the client via GET /api/arcade/wordlist so guesses can be validated
against real English words instead of accepting any 5 letters. The puzzle answer
itself is always accepted too (it may be a topical term outside this list).
"""

from __future__ import annotations

from pathlib import Path

_PATH = Path(__file__).resolve().parent.parent / "data" / "wordle_words.txt"

WORDLE_WORDS: frozenset[str] = frozenset(
    w.strip().upper() for w in _PATH.read_text(encoding="utf-8").split() if len(w.strip()) == 5
)

WORDLE_WORDS_SORTED: list[str] = sorted(WORDLE_WORDS)
