"""Grading: MCQ + flashcard deterministic; long-answer via LLM rubric with fallback."""

from __future__ import annotations

import json

from app.models.models import Question
from app.schemas.schemas import AnswerIn
from app.services.llm import FallbackLLM

GRADE_SYSTEM = """TASK:grade_long_answer
You grade a student's free-text answer against a reference answer. Reply with ONLY:
{"partial_credit": float 0.0-1.0, "feedback": str}

partial_credit: 1.0 fully correct, 0.5 partially correct, 0.0 wrong or empty.
feedback: 1-3 sentences — say specifically what was right and what was missing or wrong.
Grade on substance, not style. An empty or off-topic answer gets 0.0."""


def grade_answer(llm: FallbackLLM, q: Question, ans: AnswerIn) -> tuple[bool, float, str]:
    """Returns (is_correct, partial_credit 0-1, feedback)."""
    if q.qtype == "mcq":
        try:
            picked = int(ans.response)
        except (TypeError, ValueError):
            picked = -1
        correct = picked == q.correct_index
        feedback = q.explanation or (
            "Correct." if correct else f"The correct answer was: {q.reference_answer}"
        )
        return correct, 1.0 if correct else 0.0, feedback

    if q.qtype == "flashcard":
        correct = bool(ans.self_correct)
        return correct, 1.0 if correct else 0.0, "Self-graded recall."

    # long answer
    if not ans.response.strip():
        return False, 0.0, "No answer given."
    raw = llm.complete_json(GRADE_SYSTEM, json.dumps({
        "question": q.prompt,
        "reference_answer": q.reference_answer,
        "response": ans.response,
    }))
    try:
        credit = float(raw.get("partial_credit", 0.0))
    except (TypeError, ValueError):
        credit = 0.0
    credit = max(0.0, min(1.0, credit))
    feedback = str(raw.get("feedback", "")) or "Graded."
    return credit >= 0.7, credit, feedback
