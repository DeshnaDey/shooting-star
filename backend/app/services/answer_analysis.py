"""Post-test analysis: deterministic weak-subtopic detection + LLM diagnosis +
LLM-generated concept visualiser frames.

Weak-point rule (trust-critical, so deterministic — not left to the LLM):
a subtopic is weak if it has >= 2 questions in the attempt and earned credit
below 50% of the available credit. If nothing qualifies, the lowest-scoring
subtopic under 100% with >= 2 questions is flagged (there is always something
to study), unless the attempt is perfect.
"""

from __future__ import annotations

import json

from app.models.models import AnswerRecord, Question, Subtopic, TestAttempt, Topic
from app.schemas.schemas import (
    AnalysisPayload, ConceptFrame, GradedAnswer, SubtopicResult, WeakConcept,
)
from app.services.llm import FallbackLLM, MockProvider

DIAGNOSE_SYSTEM = """TASK:diagnose
You are a learning diagnostician. Given a student's wrong answers on one subtopic,
explain the underlying misunderstanding. Reply with ONLY: {"diagnosis": str}

The diagnosis must be 2-4 sentences, second person ("You ..."), specific to the
actual wrong answers given (quote or reference what they did), and state what the
correct mental model is. No generic study advice."""

FRAMES_SYSTEM = """TASK:frames
You create a step-through concept visualisation for a learning platform. Reply ONLY:
{"frames": [{"note": str, "values": [numbers], "highlights": [ints], "merged": [ints]}]}

The player renders each frame as vertical bars: "values" are bar heights,
"highlights" are indices of bars actively being compared/moved this step (drawn hot
pink), "merged" are indices already settled/correct (drawn purple). 5-9 frames.
Design the frames to teach THIS concept's actual mechanism step by step — each
"note" is one clear sentence (max ~25 words) explaining the step. Frame 1 shows the
initial state; the final frame shows the completed/correct state. Use 5-8 bars with
values 1-99. If the concept isn't naturally numeric, use the bars as a metaphor
(e.g. queue lengths, stack depths, probabilities) and say so in the notes."""


def analyse(
    llm: FallbackLLM,
    topic: Topic,
    subtopics: list[Subtopic],
    attempt: TestAttempt,
    questions: list[Question],
    answers: list[AnswerRecord],
) -> AnalysisPayload:
    by_id = {q.id: q for q in questions}
    sub_by_id = {s.id: s for s in subtopics}

    # per-subtopic credit
    stats: dict[str, dict] = {}
    for a in answers:
        st = stats.setdefault(a.subtopic_id, {"credit": 0.0, "total": 0, "wrong": []})
        st["credit"] += a.partial_credit
        st["total"] += 1
        if not a.is_correct:
            q = by_id.get(a.question_id)
            st["wrong"].append({
                "question": q.prompt if q else "",
                "their_answer": _shown_response(q, a),
                "correct_answer": (q.reference_answer if q else ""),
                "feedback": a.feedback,
            })

    results = [
        SubtopicResult(
            subtopicId=sid,
            name=sub_by_id[sid].name if sid in sub_by_id else sid,
            correct=round(st["credit"], 2),
            total=st["total"],
        )
        for sid, st in stats.items()
    ]

    weak_ids = _detect_weak(stats)
    weak: list[WeakConcept] = []
    for sid in weak_ids:
        name = sub_by_id[sid].name if sid in sub_by_id else sid
        st = stats[sid]
        diagnosis = _diagnose(llm, topic.name, name, st["wrong"])
        frames = _frames(llm, topic.name, name)
        weak.append(WeakConcept(
            subtopicId=sid,
            name=name,
            aiDiagnosis=diagnosis,
            wrongAnswerPattern=f"{st['total'] - round(st['credit'])} of {st['total']} {name} questions missed.",
            frames=frames,
        ))

    total_credit = sum(a.partial_credit for a in answers)
    score = round(100 * total_credit / max(1, len(answers)))
    secs = int(sum(a.time_taken_s for a in answers))

    return AnalysisPayload(
        topicId=topic.id,
        attemptId=attempt.id,
        attemptLabel=f"ATTEMPT {attempt.id:02d}",
        score=score,
        timeTaken=f"{secs // 60:02d}:{secs % 60:02d}",
        mode=(attempt.mode.replace("_", " ").upper() + (" · TIMED" if attempt.timed else "")),
        provider=llm.last_provider,
        results=results,
        weak=weak,
        answers=[
            GradedAnswer(
                questionId=a.question_id,
                prompt=by_id[a.question_id].prompt if a.question_id in by_id else "",
                response=_shown_response(by_id.get(a.question_id), a),
                correct=a.is_correct,
                partialCredit=a.partial_credit,
                feedback=a.feedback,
            )
            for a in answers
        ],
    )


def _shown_response(q: Question | None, a: AnswerRecord) -> str:
    """For MCQ, show the chosen option text rather than its index."""
    if q is not None and q.qtype == "mcq" and q.choices:
        try:
            return q.choices[int(a.response)]
        except (ValueError, TypeError, IndexError):
            return a.response
    return a.response


def _detect_weak(stats: dict[str, dict]) -> list[str]:
    weak = [
        sid for sid, st in stats.items()
        if st["total"] >= 2 and st["credit"] / st["total"] < 0.5
    ]
    if weak:
        weak.sort(key=lambda sid: stats[sid]["credit"] / stats[sid]["total"])
        return weak[:2]  # at most two weak concepts per attempt
    # fallback: weakest imperfect subtopic with enough sample
    candidates = [
        (st["credit"] / st["total"], sid) for sid, st in stats.items()
        if st["total"] >= 2 and st["credit"] / st["total"] < 1.0
    ]
    if candidates:
        candidates.sort()
        return [candidates[0][1]]
    return []


def _diagnose(llm: FallbackLLM, topic_name: str, subtopic_name: str, wrong: list[dict]) -> str:
    raw = llm.complete_json(DIAGNOSE_SYSTEM, json.dumps({
        "topic": topic_name,
        "subtopic_name": subtopic_name,
        "wrong_answers": wrong[:6],
    }))
    d = raw.get("diagnosis")
    if isinstance(d, str) and len(d.strip()) > 20:
        return d.strip()
    return MockProvider()._diagnose(json.dumps({"subtopic_name": subtopic_name}))["diagnosis"]


def _frames(llm: FallbackLLM, topic_name: str, subtopic_name: str) -> list[ConceptFrame]:
    raw = llm.complete_json(FRAMES_SYSTEM, json.dumps({
        "topic": topic_name,
        "subtopic_name": subtopic_name,
    }))
    frames = _validate_frames(raw.get("frames"))
    if frames:
        return frames
    mock = MockProvider()._frames(json.dumps({"subtopic_name": subtopic_name}))
    return _validate_frames(mock["frames"]) or []


def _validate_frames(items) -> list[ConceptFrame] | None:
    if not isinstance(items, list) or not 2 <= len(items) <= 12:
        return None
    out = []
    for f in items:
        if not isinstance(f, dict):
            return None
        note = f.get("note")
        values = f.get("values")
        if not isinstance(note, str) or not isinstance(values, list) or not values:
            return None
        try:
            values = [float(v) for v in values][:10]
            n = len(values)
            highlights = [int(i) for i in f.get("highlights", []) if isinstance(i, (int, float)) and 0 <= int(i) < n]
            merged = [int(i) for i in f.get("merged", []) if isinstance(i, (int, float)) and 0 <= int(i) < n]
        except (TypeError, ValueError):
            return None
        out.append(ConceptFrame(note=note.strip()[:200], values=values, highlights=highlights, merged=merged))
    return out
