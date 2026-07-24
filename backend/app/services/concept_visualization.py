"""Concept visualisation engine (separate from answer analysis).

Produces a multi-slide visual deck per subtopic. Slide kinds:
  - mindmap     — radial map: the concept at the centre, branches + leaves
  - definition  — hard terms broken down: formal → plain words → analogy
  - flow        — flowchart of the mechanism (nodes + arrows)
  - animation   — step-through bar animation, ONLY for genuine processes

Guardrails (enforced in code, never trusted to the model):
- 2-6 slides; first valid slide must exist or a deterministic fallback deck is used.
- mindmap: 3-6 branches, 1-5 children each; branch labels ≤6 words, leaves ≤10 words.
- definition: 1-4 terms; formal ≤35 words, simple ≤30, analogy ≤30.
- flow: 3-10 nodes, labels ≤8 words; edges must reference existing node ids.
- animation: kept only when the model flags the concept animatable AND supplies
  2-10 structurally valid frames. Invalid slides are dropped, not repaired by guesswork.
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.models import ConceptMap, Subtopic, Topic
from app.services.algorithm_animations import algorithm_animation_slide
from app.services.scene_animations import scene_animation_slide, W as SCENE_W, H as SCENE_H
from app.services.answer_analysis import _validate_frames
from app.services.llm import FallbackLLM

CONCEPT_SYSTEM = """TASK:concept_map
You create a multi-slide VISUAL study deck for ONE subtopic. Reply ONLY with JSON:
{"slides": [ ...2 to 5 slides... ]}

EVERY slide MUST also include a "narration" field: a spoken script for a
voice-over that plays while this slide is on screen, like a NotebookLM video
narrator. Write it to be SPOKEN, not read — warm, plain, flowing sentences,
25-55 words, no bullet points, no markdown. It should explain what the viewer
is looking at and why it matters, not just repeat the labels.

Slide kinds and their exact shapes:

1. MINDMAP (required, always the first slide — the big picture):
{"kind":"mindmap","title":str,"center":str,"narration":str,
 "branches":[{"label":str,"children":[str,...]}]}
- 4-6 branches covering the whole concept (what it is, how it works, key terms,
  where it's used, pitfalls, related ideas).
- branch label: MAX 6 words. children: 2-4 per branch, each a concrete fact or
  example, MAX 10 words. No filler like "various things".

2. DEFINITION (include when the subtopic has difficult terms/jargon):
{"kind":"definition","title":str,"narration":str,
 "terms":[{"term":str,"formal":str,"simple":str,"analogy":str}]}
- 2-4 of the hardest terms in this subtopic.
- formal: the textbook definition, MAX 35 words.
- simple: same idea in everyday words a 12-year-old gets, MAX 30 words.
- analogy: a vivid real-world comparison, MAX 30 words.

3. FLOW (include when there is a mechanism/sequence/causal chain):
{"kind":"flow","title":str,"narration":str,
 "nodes":[{"id":str,"label":str,"detail":str}],
 "edges":[{"from":str,"to":str,"label":str}]}
- 4-9 nodes, label MAX 8 words (a pointer, not a sentence), detail MAX 12 words.
- edges follow the actual order/causality; edge label MAX 3 words or "".

4. ANIMATION (ONLY if the concept is a step-by-step process whose state can be
honestly shown as changing bars — sorting, searching, scheduling, queues,
iterative optimisation. Definitions/taxonomies are NEVER animatable):
{"kind":"animation","title":str,"narration":str,
 "frames":[{"note":str,"values":[numbers],"highlights":[ints],"merged":[ints]}]}
- 4-8 frames, note MAX 20 words describing that exact step, 5-8 bars, values 1-99.

5. SCENE (a hand-drawn DIAGRAM THAT MOVES — use this for any real-world process
that a bar chart can't show: a molecule reacting, a force acting, a shape being
built, a system with parts moving. This is what makes it feel like an animated
explainer video, so prefer it over ANIMATION whenever the concept is visual):
{"kind":"scene","title":str,"narration":str,"width":580,"height":320,
 "frames":[{"caption":str,"action":str,"elements":[ ...elements... ]}]}
Coordinate space is width 580 (x, left→right) by 320 (y, top→bottom).
Element shapes (each MUST have a stable "id"):
  {"id":str,"kind":"node","x":num,"y":num,"r":num,"label":str,"color":"#rrggbb","textColor":"#rrggbb"}   circle w/ label
  {"id":str,"kind":"box","x":num,"y":num,"w":num,"h":num,"label":str,"color":"#rrggbb","textColor":"#rrggbb"}  rounded rect
  {"id":str,"kind":"text","x":num,"y":num,"text":str,"color":"#rrggbb","size":num,"weight":num}
  {"id":str,"kind":"line","x":num,"y":num,"x2":num,"y2":num,"color":"#rrggbb","width":num}
  {"id":str,"kind":"arrow","x":num,"y":num,"x2":num,"y2":num,"color":"#rrggbb"}   line w/ arrowhead
KEY TRICK: reuse the SAME id for the same object across frames and just change its
x/y — the frontend then SLIDES it smoothly (that's how you show something moving).
Give things that appear fade in with a new id; things that leave get dropped.
- 3-6 frames, caption MAX 18 words. 3-9 elements per frame. Keep x in 20..560,
  y in 20..300 so nothing clips. "action" is a one-word label for the step
  (e.g. "bind","split","flow","grow","done"); optional.
Colors to use: blue #6ec9e8, green #7fd6a2, gold #f6d48f, pink #d58be8, red #f6849a.

Deck rules: slide 1 = mindmap. Then choose the 1-4 other slides that genuinely
teach THIS subtopic best; include at MOST one ANIMATION or SCENE (prefer SCENE
for visual/physical processes). Be specific and content-rich — real facts, real
terms, real steps. Never pad with generic slides. Give every slide a narration."""


def _inject_algorithm_slide(payload: dict, topic: Topic, subtopic: Subtopic) -> dict:
    """If this subtopic maps to a hand-built visual — a known algorithm (bar
    animation) or a curated scene (DNA, atoms, waves, graphs…) — swap it in.
    Computed in code, not by the LLM, so it's always correct. Done at read time
    so it stays fresh even for previously-cached decks."""
    blurb = subtopic.blurb or ""
    built = (algorithm_animation_slide(topic.name, subtopic.name, blurb)
             or scene_animation_slide(topic.name, subtopic.name, blurb))
    if not built:
        return payload
    # drop any generic LLM animation/scene and insert ours right after the mindmap
    slides = [s for s in payload.get("slides", []) if s.get("kind") not in ("animation", "scene")]
    insert_at = 1 if slides and slides[0].get("kind") == "mindmap" else 0
    slides = slides[:insert_at] + [built] + slides[insert_at:]
    return {**payload, "slides": slides}


def get_concept_map(db: Session, llm: FallbackLLM, subtopic: Subtopic, topic: Topic) -> dict:
    cached = db.query(ConceptMap).filter(ConceptMap.subtopic_id == subtopic.id).first()
    # Serve cache unless it's stale: generated by mock fallback, or pre-slides shape.
    if cached and cached.provider != "mock" and "slides" in cached.payload:
        return {**_inject_algorithm_slide(cached.payload, topic, subtopic), "provider": cached.provider, "cached": True}

    raw = llm.complete_json(CONCEPT_SYSTEM, json.dumps({
        "topic": topic.name,
        "subtopic": subtopic.name,
        "blurb": subtopic.blurb,
    }))
    slides = _validate_slides(raw)

    if cached:
        if llm.last_provider == "mock" and "slides" in cached.payload:
            return {**_inject_algorithm_slide(cached.payload, topic, subtopic), "provider": cached.provider, "cached": True}
        db.delete(cached)
        db.flush()

    if not slides:
        slides = _fallback_deck(subtopic)

    payload = {
        "subtopicId": subtopic.id,
        "name": subtopic.name,
        "topicName": topic.name,
        "slides": slides,
    }
    db.add(ConceptMap(subtopic_id=subtopic.id, provider=llm.last_provider, payload=payload))
    db.commit()
    return {**_inject_algorithm_slide(payload, topic, subtopic), "provider": llm.last_provider, "cached": False}


# ─── Validation ──────────────────────────────────────────────────────────────

def _clip(text, max_words: int, max_chars: int) -> str:
    words = str(text).strip().rstrip(".").split()
    return " ".join(words[:max_words])[:max_chars]


def _narration(s: dict, derived: str) -> str:
    """Spoken voice-over for a slide. Use the model's narration when it gave a
    usable one, otherwise fall back to a script derived from the slide content
    so the video overview always has something to say."""
    raw = str(s.get("narration", "")).strip()
    if len(raw.split()) >= 6:
        # keep it speakable: cap length, don't hard-truncate mid-word
        words = raw.split()
        return " ".join(words[:60])
    return derived


def _validate_slides(raw: dict) -> list[dict]:
    slides_in = raw.get("slides")
    if not isinstance(slides_in, list):
        return []
    out: list[dict] = []
    seen_motion = False  # at most one animated visual (bar animation OR scene)
    for s in slides_in[:6]:
        if not isinstance(s, dict):
            continue
        kind = s.get("kind")
        v = None
        if kind == "mindmap":
            v = _v_mindmap(s)
        elif kind == "definition":
            v = _v_definition(s)
        elif kind == "flow":
            v = _v_flow(s)
        elif kind == "animation" and not seen_motion:
            v = _v_animation(s)
            seen_motion = v is not None
        elif kind == "scene" and not seen_motion:
            v = _v_scene(s)
            seen_motion = v is not None
        if v:
            out.append(v)
    # a deck must lead with a mindmap; tolerate wrong ordering by re-sorting
    out.sort(key=lambda x: 0 if x["kind"] == "mindmap" else 1)
    return out[:6]


def _v_mindmap(s: dict) -> dict | None:
    branches_in = s.get("branches")
    if not isinstance(branches_in, list) or not 2 <= len(branches_in) <= 8:
        return None
    branches = []
    for b in branches_in[:6]:
        if not isinstance(b, dict) or not str(b.get("label", "")).strip():
            return None
        children = [
            _clip(c, 10, 70) for c in (b.get("children") or [])[:5]
            if isinstance(c, str) and c.strip()
        ]
        if not children:
            return None
        branches.append({"label": _clip(b["label"], 6, 44), "children": children})
    if len(branches) < 2:
        return None
    center = _clip(s.get("center", ""), 5, 36) or "Concept"
    derived = (
        f"Let's start with the big picture of {center}. "
        f"It breaks down into {len(branches)} parts — "
        + ", ".join(b["label"] for b in branches)
        + ". Keep these branches in mind as we go deeper."
    )
    return {
        "kind": "mindmap",
        "title": _clip(s.get("title", "The big picture"), 8, 60) or "The big picture",
        "center": center,
        "branches": branches,
        "narration": _narration(s, derived),
    }


def _v_definition(s: dict) -> dict | None:
    terms_in = s.get("terms")
    if not isinstance(terms_in, list) or not terms_in:
        return None
    terms = []
    for t in terms_in[:4]:
        if not isinstance(t, dict):
            continue
        term = str(t.get("term", "")).strip()
        formal, simple = str(t.get("formal", "")).strip(), str(t.get("simple", "")).strip()
        if not term or not formal or not simple:
            continue
        terms.append({
            "term": _clip(term, 6, 48),
            "formal": _clip(formal, 35, 240),
            "simple": _clip(simple, 30, 210),
            "analogy": _clip(t.get("analogy", ""), 30, 210),
        })
    if not terms:
        return None
    first = terms[0]
    derived = (
        f"Now the words that trip people up. Take {first['term']}: "
        f"{first['simple']}"
        + (f" Think of it like {first['analogy'].rstrip('.')}." if first["analogy"] else "")
    )
    return {
        "kind": "definition",
        "title": _clip(s.get("title", "Hard words, simply"), 8, 60) or "Hard words, simply",
        "terms": terms,
        "narration": _narration(s, derived),
    }


def _v_flow(s: dict) -> dict | None:
    nodes_in = s.get("nodes")
    if not isinstance(nodes_in, list) or not 3 <= len(nodes_in) <= 10:
        return None
    nodes, ids = [], set()
    for n in nodes_in[:10]:
        if not isinstance(n, dict):
            return None
        nid = str(n.get("id", "")).strip()[:30]
        label = str(n.get("label", "")).strip()
        if not nid or nid in ids or not label:
            return None
        ids.add(nid)
        nodes.append({"id": nid, "label": _clip(label, 8, 60), "detail": _clip(n.get("detail", ""), 12, 90)})
    edges = []
    for e in (s.get("edges") or [])[:14]:
        if not isinstance(e, dict):
            continue
        a, b = str(e.get("from", "")).strip()[:30], str(e.get("to", "")).strip()[:30]
        if a in ids and b in ids and a != b:
            edges.append({"from": a, "to": b, "label": _clip(e.get("label", ""), 3, 24)})
    derived = (
        "Here's how it actually works, step by step. We start at "
        f"{nodes[0]['label']} and follow the arrows through to "
        f"{nodes[-1]['label']}. Watch how each stage feeds the next."
    )
    return {
        "kind": "flow",
        "title": _clip(s.get("title", "How it works"), 8, 60) or "How it works",
        "nodes": nodes,
        "edges": edges,
        "narration": _narration(s, derived),
    }


def _v_animation(s: dict) -> dict | None:
    frames = _validate_frames(s.get("frames"))
    if not frames:
        return None
    dumped = [f.model_dump() for f in frames]
    derived = (
        "Now let's watch it run. "
        f"{dumped[0]['note'].rstrip('.')}. "
        f"Follow the highlighted bars across all {len(dumped)} steps to the finish."
    )
    return {
        "kind": "animation",
        "title": _clip(s.get("title", "Watch it run"), 8, 60) or "Watch it run",
        "frames": dumped,
        "narration": _narration(s, derived),
    }


import re

_HEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")
_RGB = re.compile(r"^rgba?\([\d.,\s%]+\)$")
_SCENE_KINDS = {"node", "box", "text", "line", "arrow"}


def _num(v, lo: float, hi: float, default: float) -> float:
    """Coerce to a float clamped into [lo, hi]; fall back to default on garbage."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    if f != f:  # NaN
        return default
    return max(lo, min(hi, f))


def _color(v, default: str) -> str:
    if isinstance(v, str) and (_HEX.match(v) or _RGB.match(v)) and len(v) <= 32:
        return v
    return default


def _v_element(e: dict, idx: int) -> dict | None:
    """Validate + clamp a single scene element so bad model output still renders
    safely on the canvas (nothing off-screen, no unsafe colour strings)."""
    if not isinstance(e, dict):
        return None
    kind = e.get("kind")
    if kind not in _SCENE_KINDS:
        return None
    eid = str(e.get("id", "") or f"e{idx}")[:24]
    x = _num(e.get("x"), 20, SCENE_W - 20, SCENE_W / 2)
    y = _num(e.get("y"), 20, SCENE_H - 20, SCENE_H / 2)
    op = _num(e.get("opacity", 1), 0, 1, 1)
    out = {"id": eid, "kind": kind, "x": x, "y": y, "opacity": op}

    if kind in ("line", "arrow"):
        out["x2"] = _num(e.get("x2"), 0, SCENE_W, x)
        out["y2"] = _num(e.get("y2"), 0, SCENE_H, y)
        out["color"] = _color(e.get("color"), "#6ec9e8")
        out["width"] = _num(e.get("width", 2), 1, 8, 2)
        dash = e.get("dash")
        if isinstance(dash, str) and re.match(r"^[\d\s]{1,12}$", dash):
            out["dash"] = dash
        return out

    if kind == "text":
        text = str(e.get("text", "")).strip()[:60]
        if not text:
            return None
        out["text"] = text
        out["color"] = _color(e.get("color"), "#cfe4f5")
        out["size"] = _num(e.get("size", 12), 8, 40, 12)
        out["weight"] = int(_num(e.get("weight", 400), 100, 900, 400))
        anchor = e.get("anchor")
        out["anchor"] = anchor if anchor in ("start", "middle", "end") else "middle"
        return out

    if kind == "box":
        out["w"] = _num(e.get("w", 54), 12, SCENE_W - 20, 54)
        out["h"] = _num(e.get("h", 30), 12, SCENE_H - 20, 30)
        out["rx"] = _num(e.get("rx", 6), 0, 40, 6)
        out["label"] = str(e.get("label", ""))[:24]
        out["color"] = _color(e.get("color"), "#9d6fc8")
        out["textColor"] = _color(e.get("textColor"), "#ffffff")
        return out

    # node
    out["r"] = _num(e.get("r", 16), 4, 120, 16)
    out["label"] = str(e.get("label", ""))[:20]
    out["color"] = _color(e.get("color"), "#6ec9e8")
    out["textColor"] = _color(e.get("textColor"), "#08131f")
    return out


def _v_scene(s: dict) -> dict | None:
    """Validate an LLM-authored 'scene' slide. Clamps every coordinate to the
    canvas and sanitises colours, so even a weak model produces a scene that
    renders without clipping or breaking the SVG. Returns None if unsalvageable."""
    frames_in = s.get("frames")
    if not isinstance(frames_in, list) or len(frames_in) < 2:
        return None
    frames: list[dict] = []
    for f in frames_in[:8]:
        if not isinstance(f, dict):
            continue
        els_in = f.get("elements")
        if not isinstance(els_in, list):
            continue
        els = []
        for i, e in enumerate(els_in[:12]):
            ve = _v_element(e, i)
            if ve:
                els.append(ve)
        if not els:
            continue
        frame = {"caption": _clip(f.get("caption", ""), 18, 130) or "…", "elements": els}
        action = f.get("action")
        if isinstance(action, str) and action.strip():
            frame["action"] = action.strip().lower()[:16]
        frames.append(frame)
    if len(frames) < 2:
        return None
    derived = (
        "Let's watch this happen. "
        f"{frames[0]['caption'].rstrip('.')}. "
        f"Follow it through all {len(frames)} steps to the end."
    )
    return {
        "kind": "scene",
        "title": _clip(s.get("title", "Watch it happen"), 8, 60) or "Watch it happen",
        "width": SCENE_W,
        "height": SCENE_H,
        "frames": frames,
        "narration": _narration(s, derived),
    }


def _fallback_deck(subtopic: Subtopic) -> list[dict]:
    name = subtopic.name
    return [
        {
            "kind": "mindmap",
            "title": "The big picture",
            "center": name,
            "branches": [
                {"label": "What it is", "children": [subtopic.blurb[:70] or "The core idea", "Why it matters"]},
                {"label": "How it works", "children": ["The mechanism, step by step", "The order things happen in"]},
                {"label": "Watch out for", "children": ["The mistakes most students make", "Edge cases that break intuition"]},
                {"label": "Where it's used", "children": ["Typical problems it solves", "Real-world applications"]},
            ],
            "narration": (
                f"Let's map out {name}. There are four things worth holding onto: "
                "what it is, how it works, what to watch out for, and where it's used. "
                "Connect the AI engine for a deeper, subject-specific walkthrough."
            ),
        },
        {
            "kind": "definition",
            "title": "Hard words, simply",
            "terms": [{
                "term": name,
                "formal": subtopic.blurb or f"The formal definition of {name}.",
                "simple": f"{name}, explained in plain words — connect the AI engine for a real breakdown.",
                "analogy": "",
            }],
            "narration": (
                f"Here's {name} in plain words. This is the offline preview — "
                "turn on the AI engine and you'll get the real terms broken down "
                "with everyday analogies."
            ),
        },
    ]
