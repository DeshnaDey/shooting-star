"""Knowledge Arcade — turn a studied topic into word puzzles.

Division of labour (mirrors the rest of the app: the LLM writes *content*, Python
owns *structure*):

  - The LLM's only job is to produce a themed WORD BANK: real words related to the
    topic, each with a short crossword-style clue and the subtopic it belongs to.
    See ``build_word_bank`` / ``TASK:arcade_wordbank``.
  - ``app.services.arcade_puzzles`` then assembles the four games (Wordle, Spelling
    Bee, mini Crossword, Strands word-search) deterministically from that bank, so a
    weak/offline model can never hand us a broken grid.

If the LLM is unreachable the MockProvider fabricates a bank from the subtopic
names, so the arcade always works offline.
"""

from __future__ import annotations

import json
import re

from sqlalchemy.orm import Session

from app.models.models import ArcadePuzzle, Subtopic, Topic
from app.services.arcade_puzzles import build_puzzles
from app.services.llm import FallbackLLM, MockProvider

WORDBANK_SYSTEM = """TASK:arcade_wordbank
You build a themed WORD BANK for word-puzzle games (Wordle, Spelling Bee,
crossword, word-search) about ONE study topic. Reply with ONLY a JSON object:
{"words": [ {"word": str, "clue": str, "subtopic": str}, ... ]}

Rules:
- 14-20 entries. Each "word" is a SINGLE real English word, 4-8 letters, letters
  A-Z only (no spaces, digits, hyphens or accents). Uppercase them.
- Words must be genuinely related to the topic / its subtopics — the kind of term a
  student would have learned. Prefer nouns.
- "clue" is a short crossword-style clue (max 12 words) that describes the word
  WITHOUT containing the word itself or an obvious form of it.
- "subtopic" MUST be one of the provided subtopic names (this powers the "which
  star did this come from" reveal).
- Include a good spread of lengths: at least four 5-letter words (for Wordle) and,
  if you can, one longer word that uses many different letters (for Spelling Bee).
- No duplicates."""


def _clean_word(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    w = re.sub(r"[^A-Za-z]", "", raw).upper()
    if 4 <= len(w) <= 8:
        return w
    return None


def _validate_bank(items: object, valid_subs: dict[str, str]) -> list[dict]:
    """valid_subs maps lowercase subtopic name -> canonical name."""
    out: list[dict] = []
    seen: set[str] = set()
    if not isinstance(items, list):
        return out
    for it in items:
        if not isinstance(it, dict):
            continue
        word = _clean_word(it.get("word"))
        clue = it.get("clue")
        if not word or word in seen or not isinstance(clue, str) or not clue.strip():
            continue
        # drop clues that give the answer away
        if word.lower() in re.sub(r"[^a-z]", " ", clue.lower()).split():
            continue
        sub_raw = str(it.get("subtopic", "")).strip().lower()
        subtopic = valid_subs.get(sub_raw)
        if subtopic is None and valid_subs:
            # tolerate loose matches (model paraphrased the subtopic name)
            for low, canon in valid_subs.items():
                if low and (low in sub_raw or sub_raw in low):
                    subtopic = canon
                    break
        subtopic = subtopic or next(iter(valid_subs.values()), "General")
        seen.add(word)
        out.append({"word": word, "clue": clue.strip(), "subtopic": subtopic})
    return out


def build_word_bank(llm: FallbackLLM, topic: Topic, subtopics: list[Subtopic]) -> list[dict]:
    """Return a validated list of {word, clue, subtopic}. Always non-empty."""
    valid_subs = {s.name.strip().lower(): s.name for s in subtopics}
    spec = {
        "topic": topic.name,
        "blurb": topic.blurb,
        "subtopics": [{"name": s.name, "blurb": s.blurb} for s in subtopics],
    }
    raw = llm.complete_json(WORDBANK_SYSTEM, json.dumps(spec))
    bank = _validate_bank(raw.get("words", []), valid_subs)

    # top up from the deterministic bank if the model under-delivered
    if len(bank) < 12:
        mock_raw = MockProvider().complete_json("TASK:arcade_wordbank", json.dumps(spec))
        have = {b["word"] for b in bank}
        for b in _validate_bank(mock_raw.get("words", []), valid_subs):
            if b["word"] not in have:
                bank.append(b)
                have.add(b["word"])
    return bank


def get_arcade(
    db: Session,
    llm: FallbackLLM,
    topic: Topic,
    subtopics: list[Subtopic],
    refresh: bool = False,
) -> dict:
    """Get-or-build the cached arcade bundle for a topic (mirrors get_concept_map)."""
    row = db.query(ArcadePuzzle).filter(ArcadePuzzle.topic_id == topic.id).first()
    if row and not refresh:
        return {**row.payload, "cached": True}

    bank = build_word_bank(llm, topic, subtopics)
    puzzles = build_puzzles(bank, topic.id, topic.name)
    payload = {
        "topicId": topic.id,
        "topicName": topic.name,
        "provider": llm.last_provider,
        **puzzles,
    }
    if row:
        row.payload = payload
        row.provider = llm.last_provider
    else:
        db.add(ArcadePuzzle(topic_id=topic.id, provider=llm.last_provider, payload=payload))
    db.commit()
    return {**payload, "cached": False}
