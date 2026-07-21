"""LLM adapter.

Providers:
  - OllamaProvider: OpenAI-compatible /v1/chat/completions with JSON mode.
    Works with local Ollama (http://localhost:11434) or Ollama Cloud
    (base_url https://ollama.com + api key).
  - MockProvider: deterministic, offline. Used when LLM_PROVIDER=mock or as an
    automatic fallback when Ollama is unreachable, so the app always works.

All call sites use complete_json() and validate/repair the result, so a weak
local model emitting imperfect JSON degrades gracefully rather than erroring.
"""

from __future__ import annotations

import json
import logging
import re

import httpx

from app.core.config import get_settings

log = logging.getLogger("shooting-star.llm")


class LLMError(Exception):
    pass


class OllamaProvider:
    name = "ollama"

    def __init__(self) -> None:
        s = get_settings()
        self.base_url = s.ollama_base_url.rstrip("/")
        self.model = s.ollama_model
        self.timeout = s.llm_timeout_s
        self.headers = {"Content-Type": "application/json"}
        if s.ollama_api_key:
            self.headers["Authorization"] = f"Bearer {s.ollama_api_key}"

    def complete_json(self, system: str, user: str) -> dict:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
            "max_tokens": 6000,   # decks/question sets are long; avoid truncated JSON
            "stream": False,
        }
        if "gpt-oss" in self.model or "deepseek" in self.model or "qwen3" in self.model:
            # reasoning models: cap thinking time so structured-output calls stay fast
            body["reasoning_effort"] = "low"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                r = client.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers=self.headers,
                    json=body,
                )
                r.raise_for_status()
                content = r.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise LLMError(f"ollama request failed: {e}") from e
        return _extract_json(content)


def _extract_json(text: str) -> dict:
    """Parse a JSON object out of model output, tolerating <think> blocks and fences."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"```(?:json)?", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    raise LLMError(f"could not parse JSON from model output: {text[:200]}")


class MockProvider:
    """Deterministic offline provider. Understands the three task tags the
    services put in their system prompts and returns valid, useful shapes."""

    name = "mock"

    def complete_json(self, system: str, user: str) -> dict:
        if "TASK:generate_questions" in system:
            return self._questions(user)
        if "TASK:grade_long_answer" in system:
            return self._grade(user)
        if "TASK:grade_code" in system:
            return self._grade(user)
        if "TASK:diagnose" in system:
            return self._diagnose(user)
        if "TASK:frames" in system:
            return self._frames(user)
        if "TASK:design_topic" in system:
            return self._design_topic(user)
        if "TASK:concept_map" in system:
            return self._concept_map(user)
        return {}

    def _concept_map(self, user: str) -> dict:
        spec = json.loads(user)
        name = spec.get("subtopic", "Concept")
        blurb = spec.get("blurb", "")
        return {"slides": [
            {
                "kind": "mindmap",
                "title": "The big picture",
                "center": name,
                "branches": [
                    {"label": "What it is", "children": [blurb[:70] or "The core idea", "Why it matters"]},
                    {"label": "How it works", "children": ["The mechanism, step by step", "The order things happen in"]},
                    {"label": "Watch out for", "children": ["Mistakes most students make", "Edge cases that break intuition"]},
                    {"label": "Where it's used", "children": ["Typical problems it solves", "Real-world applications"]},
                ],
            },
            {
                "kind": "definition",
                "title": "Hard words, simply",
                "terms": [{
                    "term": name,
                    "formal": blurb or f"The formal definition of {name}.",
                    "simple": f"{name} in plain words — connect the AI engine (Ollama) for a real breakdown.",
                    "analogy": "",
                }],
            },
            {
                "kind": "flow",
                "title": "How it works",
                "nodes": [
                    {"id": "def", "label": f"What {name} is", "detail": blurb[:80] or "Core definition"},
                    {"id": "mech", "label": "Core mechanism", "detail": "The steps it follows, in order"},
                    {"id": "use", "label": "Where it's used", "detail": "Typical problems and applications"},
                    {"id": "trap", "label": "Common pitfalls", "detail": "The mistakes students usually make"},
                ],
                "edges": [
                    {"from": "def", "to": "mech", "label": ""},
                    {"from": "mech", "to": "use", "label": ""},
                    {"from": "mech", "to": "trap", "label": "careful"},
                ],
            },
        ]}

    def _design_topic(self, user: str) -> dict:
        spec = json.loads(user)
        name = spec.get("name", "New Topic")
        return {
            "tag": "STUDY",
            "blurb": f"Chart the {name} system, one concept at a time.",
            "subtopics": [
                {"name": f"{name} Foundations", "blurb": f"The core definitions and building blocks of {name}."},
                {"name": "Core Mechanisms", "blurb": f"How {name} actually works, step by step."},
                {"name": "Common Pitfalls", "blurb": f"The mistakes and misconceptions most students hit in {name}."},
                {"name": "Applications", "blurb": f"Where {name} shows up in real problems."},
            ],
        }

    # -- deterministic question bank ----------------------------------------
    def _questions(self, user: str) -> dict:
        spec = json.loads(user)
        subtopics = spec["subtopics"]
        n = spec["num_questions"]
        qtype = spec["qtype"]
        out = []
        for i in range(n):
            st = subtopics[i % len(subtopics)]
            name = st["name"]
            if qtype == "mcq":
                out.append({
                    "subtopic_id": st["id"],
                    "prompt": f"[{name}] Which statement about {name.lower()} is TRUE?",
                    "choices": [
                        f"{name} always runs in O(1) time regardless of input.",
                        f"{name} is correctly described by its core mechanism.",
                        f"{name} cannot be implemented without recursion.",
                        f"{name} only works on already-sorted input.",
                    ],
                    "correct_index": 1,
                    "explanation": f"The second option states the defining property of {name}.",
                })
            elif qtype == "long_answer":
                out.append({
                    "subtopic_id": st["id"],
                    "prompt": f"Explain how {name.lower()} works, step by step, and name one common pitfall.",
                    "reference_answer": f"A correct answer describes the mechanism of {name} in order, "
                                        f"states its complexity/behaviour, and names a pitfall.",
                    "explanation": "",
                })
            elif qtype == "viva":
                out.append({
                    "subtopic_id": st["id"],
                    "prompt": f"Walk me through how {name.lower()} works, and explain why it behaves that way.",
                    "reference_answer": f"A correct spoken answer describes the mechanism of {name} in order, "
                                        f"states its complexity/behaviour, and explains the reasoning.",
                    "explanation": "",
                })
            elif qtype == "coding":
                out.append({
                    "subtopic_id": st["id"],
                    "prompt": f"Implement {name.lower()} in the given function.",
                    "language": "python",
                    "starter_code": f"def solve(data):\n    # implement {name.lower()} here\n    pass",
                    "reference_answer": f"A correct solution implements the core mechanism of {name} "
                                        f"and produces the expected result for typical inputs.",
                    "explanation": "",
                })
            else:  # flashcard
                out.append({
                    "subtopic_id": st["id"],
                    "prompt": f"{name}: what is its core mechanism?",
                    "reference_answer": st.get("blurb", f"The defining mechanism of {name}."),
                    "explanation": "",
                })
        return {"questions": out}

    def _grade(self, user: str) -> dict:
        spec = json.loads(user)
        resp = spec.get("response", "").strip()
        words = len(resp.split())
        credit = 0.0 if words < 5 else 0.5 if words < 25 else 0.8
        return {
            "partial_credit": credit,
            "feedback": "Mock grading (LLM offline): graded on answer length only. "
                        "Connect Ollama for real rubric grading.",
        }

    def _diagnose(self, user: str) -> dict:
        spec = json.loads(user)
        name = spec.get("subtopic_name", "this concept")
        return {
            "diagnosis": f"Your answers on {name} were consistently incorrect while neighbouring "
                         f"subtopics held up, which points to a gap in the core mechanism of {name} "
                         f"rather than a careless slip. Step through the visualisation to rebuild the "
                         f"mental model, then retake the test. (Mock analysis — connect Ollama for a "
                         f"diagnosis grounded in your actual wrong answers.)",
        }

    def _frames(self, user: str) -> dict:
        spec = json.loads(user)
        name = spec.get("subtopic_name", "Concept")
        return {"frames": [
            {"note": f"{name}: initial state — before any operation.", "values": [30, 55, 20, 70, 45], "highlights": [], "merged": []},
            {"note": "Step 1 — the first transition the concept applies.", "values": [30, 55, 20, 70, 45], "highlights": [1, 3], "merged": []},
            {"note": "Step 2 — intermediate state; notice what changed and why.", "values": [30, 70, 20, 55, 45], "highlights": [1, 3], "merged": [1]},
            {"note": "Step 3 — the invariant that most wrong answers violated.", "values": [20, 30, 45, 55, 70], "highlights": [], "merged": [0, 1, 2]},
            {"note": "Final state — the correct end result.", "values": [20, 30, 45, 55, 70], "highlights": [], "merged": [0, 1, 2, 3, 4]},
        ]}


class FallbackLLM:
    """Tries the primary provider, falls back to mock on failure."""

    def __init__(self, primary) -> None:
        self.primary = primary
        self.mock = MockProvider()
        self.last_provider = primary.name

    def complete_json(self, system: str, user: str) -> dict:
        try:
            result = self.primary.complete_json(system, user)
            self.last_provider = self.primary.name
            return result
        except LLMError as e:
            log.warning("LLM primary failed, using mock: %s", e)
            self.last_provider = "mock"
            return self.mock.complete_json(system, user)


def get_llm() -> FallbackLLM:
    s = get_settings()
    if s.llm_provider == "mock":
        return FallbackLLM(MockProvider())
    return FallbackLLM(OllamaProvider())
