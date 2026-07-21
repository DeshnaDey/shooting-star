"""Question generation via LLM, with strict validation and per-question fallback."""

from __future__ import annotations

import json

from app.models.models import Subtopic, Topic
from app.services.llm import FallbackLLM, MockProvider

SYSTEM = """TASK:generate_questions
You generate quiz questions for a learning platform. Reply with ONLY a JSON object:
{"questions": [ ... ]}

For qtype "mcq" each item: {"subtopic_id": str, "prompt": str, "choices": [4 strings],
"correct_index": int 0-3, "explanation": str}
For qtype "long_answer" each item: {"subtopic_id": str, "prompt": str,
"reference_answer": str (model answer / rubric), "explanation": ""}
For qtype "flashcard" each item: {"subtopic_id": str, "prompt": str (front),
"reference_answer": str (back), "explanation": ""}
For qtype "viva" each item: {"subtopic_id": str, "prompt": str, "reference_answer": str
(grading rubric), "explanation": ""} — same shape as long_answer, but these are spoken/oral
exam questions: phrase prompts like "Explain...", "Walk me through...", "Why does...", never
written-essay style.
For qtype "coding" each item: {"subtopic_id": str, "prompt": str (problem statement),
"language": str (e.g. "python"), "starter_code": str (short function signature or snippet),
"reference_answer": str (rubric describing what a correct solution must do — this is what
the grader checks against, never shown to the student)}

Rules:
- Every question MUST use one of the provided subtopic_ids (this tagging powers weak-point analysis).
- Spread questions across the given subtopics; if a focus subtopic is given, put ~60% there.
- Questions must be specific and technically accurate, difficulty appropriate for an undergraduate.
- MCQ distractors must be plausible but definitively wrong."""


def generate_questions(
    llm: FallbackLLM,
    topic: Topic,
    subtopics: list[Subtopic],
    qtype: str,
    num_questions: int,
    focus_subtopic_id: str | None,
) -> list[dict]:
    spec = {
        "topic": topic.name,
        "qtype": qtype,
        "num_questions": num_questions,
        "focus_subtopic_id": focus_subtopic_id,
        "subtopics": [{"id": s.id, "name": s.name, "blurb": s.blurb} for s in subtopics],
    }
    raw = llm.complete_json(SYSTEM, json.dumps(spec))
    valid_ids = {s.id for s in subtopics}
    questions = _validate(raw.get("questions", []), qtype, valid_ids)

    # top up with deterministic questions if the model under-delivered
    if len(questions) < num_questions:
        mock_raw = MockProvider().complete_json("TASK:generate_questions", json.dumps(spec))
        for q in _validate(mock_raw["questions"], qtype, valid_ids):
            if len(questions) >= num_questions:
                break
            if all(q["prompt"] != have["prompt"] for have in questions):
                questions.append(q)

    return questions[:num_questions]


def _validate(items: list, qtype: str, valid_ids: set[str]) -> list[dict]:
    out = []
    if not isinstance(items, list):
        return out
    for q in items:
        if not isinstance(q, dict):
            continue
        sid = q.get("subtopic_id")
        prompt = q.get("prompt")
        if sid not in valid_ids or not isinstance(prompt, str) or not prompt.strip():
            continue
        if qtype == "mcq":
            choices = q.get("choices")
            ci = q.get("correct_index")
            if (not isinstance(choices, list) or len(choices) != 4
                    or not all(isinstance(c, str) for c in choices)
                    or not isinstance(ci, int) or not 0 <= ci <= 3):
                continue
            out.append({
                "subtopic_id": sid, "prompt": prompt.strip(), "choices": choices,
                "correct_index": ci, "reference_answer": choices[ci],
                "explanation": str(q.get("explanation", "")),
                "starter_code": None, "language": None,
            })
        elif qtype == "coding":
            ref = q.get("reference_answer")
            language = q.get("language")
            starter_code = q.get("starter_code")
            if (not isinstance(ref, str) or not ref.strip()
                    or not isinstance(language, str) or not language.strip()
                    or not isinstance(starter_code, str) or not starter_code.strip()):
                continue
            out.append({
                "subtopic_id": sid, "prompt": prompt.strip(), "choices": None,
                "correct_index": None, "reference_answer": ref.strip(),
                "explanation": str(q.get("explanation", "")),
                "starter_code": starter_code.strip(), "language": language.strip(),
            })
        else:
            ref = q.get("reference_answer")
            if not isinstance(ref, str) or not ref.strip():
                continue
            out.append({
                "subtopic_id": sid, "prompt": prompt.strip(), "choices": None,
                "correct_index": None, "reference_answer": ref.strip(),
                "explanation": str(q.get("explanation", "")),
                "starter_code": None, "language": None,
            })
    return out
