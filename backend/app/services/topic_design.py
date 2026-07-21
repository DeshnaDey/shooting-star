"""Create a topic: the LLM designs the subtopic breakdown; ids are server-generated."""

from __future__ import annotations

import json
import re

from sqlalchemy.orm import Session

from app.models.models import Subtopic, Topic
from app.services.llm import FallbackLLM, MockProvider

DESIGN_SYSTEM = """TASK:design_topic
You design the study structure for a topic on a learning platform. Reply ONLY:
{"tag": str, "blurb": str, "subtopics": [{"name": str, "blurb": str}]}

tag: 1-2 word category in CAPS (e.g. "ALGORITHMS", "PHYSICS", "LANGUAGE").
blurb: one poetic-but-informative sentence about the topic (max 12 words).
subtopics: 4-6 concrete, testable subtopics a student must master, ordered from
foundational to advanced. Each blurb: one sentence, max 12 words. Subtopic names
must be specific concepts (e.g. "Merge Sort"), not vague labels (e.g. "Basics")."""


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:36] or "topic"


def create_topic(db: Session, llm: FallbackLLM, name: str, user_id: int) -> Topic:
    name = name.strip()[:80]
    raw = llm.complete_json(DESIGN_SYSTEM, json.dumps({"name": name}))
    subs = _valid_subtopics(raw)
    if not subs:
        raw = MockProvider()._design_topic(json.dumps({"name": name}))
        subs = _valid_subtopics(raw)

    base = slugify(name)
    topic_id = base
    n = 2
    while db.get(Topic, topic_id) is not None:
        topic_id = f"{base}-{n}"
        n += 1

    tag = str(raw.get("tag", "STUDY"))[:24].upper() or "STUDY"
    blurb = str(raw.get("blurb", ""))[:160]
    topic = Topic(id=topic_id, user_id=user_id, name=name, tag=tag, blurb=blurb)
    db.add(topic)

    used: set[str] = set()
    for s in subs:
        sid = f"{topic_id}-{slugify(s['name'])[:24]}"
        m = 2
        while sid in used:
            sid = f"{topic_id}-{slugify(s['name'])[:22]}-{m}"
            m += 1
        used.add(sid)
        db.add(Subtopic(id=sid, topic_id=topic_id, name=s["name"][:80], blurb=s["blurb"][:160], mastery=0))

    db.commit()
    db.refresh(topic)
    return topic


def _valid_subtopics(raw: dict) -> list[dict]:
    subs = raw.get("subtopics")
    if not isinstance(subs, list):
        return []
    out = []
    for s in subs[:6]:
        if isinstance(s, dict) and isinstance(s.get("name"), str) and s["name"].strip():
            out.append({"name": s["name"].strip(), "blurb": str(s.get("blurb", "")).strip()})
    return out if len(out) >= 2 else []
