from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import create_token, get_current_user, hash_password, verify_password
from app.db.session import get_db
from app.models.models import (
    AnalysisResult, AnswerRecord, Question, Subtopic, TestAttempt, Topic, User,
)
from app.schemas.schemas import (
    AnalysisPayload, AttemptOut, CreateAttemptIn, QuestionOut, SubmitIn,
    SubtopicOut, TopicOut,
)
from app.services.answer_analysis import analyse
from app.services.concept_visualization import get_concept_map
from app.services.grading import grade_answer
from app.services.llm import get_llm
from app.services.quiz_generation import generate_questions
from app.services.topic_design import create_topic

router = APIRouter(prefix="/api")

SECONDS_PER_QUESTION = {"mcq": 45, "long_answer": 240, "flashcard": 30}


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: str
    password: str

class AuthOut(BaseModel):
    token: str
    name: str
    email: str


@router.post("/auth/register", response_model=AuthOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "an account with this email already exists")
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthOut(token=create_token(user.id), name=user.name, email=user.email)


@router.post("/auth/login", response_model=AuthOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "invalid email or password")
    return AuthOut(token=create_token(user.id), name=user.name, email=user.email)


class MeOut(BaseModel):
    name: str
    email: str

@router.get("/auth/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(name=user.name, email=user.email)


def _topic_out(t: Topic, db: Session, user: User) -> TopicOut:
    tested = (
        db.query(TestAttempt.id)
        .filter(TestAttempt.topic_id == t.id, TestAttempt.user_id == user.id,
                TestAttempt.status == "submitted")
        .first()
        is not None
    )
    progress = round(sum(s.mastery for s in t.subtopics) / len(t.subtopics)) if t.subtopics else 0
    return TopicOut(
        id=t.id, name=t.name, tag=t.tag, blurb=t.blurb,
        lit=tested, progress=progress,
        subtopics=[SubtopicOut(id=s.id, name=s.name, blurb=s.blurb, mastery=s.mastery) for s in t.subtopics],
    )


def _owned_topic(db: Session, user: User, topic_id: str) -> Topic:
    topic = db.get(Topic, topic_id)
    if not topic or topic.user_id != user.id:
        raise HTTPException(404, "unknown topic")
    return topic


# ─── Topics (per-user sky) ───────────────────────────────────────────────────

@router.get("/topics", response_model=list[TopicOut])
def list_topics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topics = db.query(Topic).filter(Topic.user_id == user.id).all()
    return [_topic_out(t, db, user) for t in topics]


class CreateTopicIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)


@router.post("/topics", response_model=TopicOut)
def add_topic(body: CreateTopicIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    llm = get_llm()
    topic = create_topic(db, llm, body.name, user.id)
    return _topic_out(topic, db, user)


# ─── Concept visualisation (separate AI engine, cached per subtopic) ─────────

@router.get("/subtopics/{subtopic_id}/concept")
def subtopic_concept(subtopic_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sub = db.get(Subtopic, subtopic_id)
    if not sub:
        raise HTTPException(404, "unknown subtopic")
    topic = _owned_topic(db, user, sub.topic_id)
    llm = get_llm()
    return get_concept_map(db, llm, sub, topic)


# ─── Attempts ────────────────────────────────────────────────────────────────

def _attempt_out(attempt: TestAttempt, questions: list[Question], sub_names: dict[str, str]) -> AttemptOut:
    return AttemptOut(
        id=attempt.id,
        topic_id=attempt.topic_id,
        mode=attempt.mode,
        timed=attempt.timed,
        time_limit_s=attempt.time_limit_s,
        status=attempt.status,
        llm_provider=attempt.llm_provider,
        questions=[
            QuestionOut(
                id=q.id,
                subtopic_id=q.subtopic_id,
                subtopic_name=sub_names.get(q.subtopic_id, q.subtopic_id),
                qtype=q.qtype,
                prompt=q.prompt,
                choices=q.choices,
                flashcard_back=q.reference_answer if q.qtype == "flashcard" else None,
            )
            for q in questions
        ],
    )


@router.post("/attempts", response_model=AttemptOut)
def create_attempt(body: CreateAttemptIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = _owned_topic(db, user, body.topic_id)
    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic.id).all()
    if body.focus_subtopic_id and body.focus_subtopic_id not in {s.id for s in subtopics}:
        raise HTTPException(400, "focus subtopic not in topic")

    llm = get_llm()
    generated = generate_questions(
        llm, topic, subtopics, body.mode, body.num_questions, body.focus_subtopic_id
    )
    if not generated:
        raise HTTPException(502, "question generation failed")

    attempt = TestAttempt(
        user_id=user.id,
        topic_id=topic.id,
        mode=body.mode,
        timed=body.timed,
        time_limit_s=body.num_questions * SECONDS_PER_QUESTION[body.mode] if body.timed else 0,
        focus_subtopic_id=body.focus_subtopic_id,
        llm_provider=llm.last_provider,
    )
    db.add(attempt)
    db.flush()
    questions = [
        Question(
            attempt_id=attempt.id,
            subtopic_id=g["subtopic_id"],
            qtype=body.mode,
            prompt=g["prompt"],
            choices=g["choices"],
            correct_index=g["correct_index"],
            reference_answer=g["reference_answer"],
            explanation=g["explanation"],
        )
        for g in generated
    ]
    db.add_all(questions)
    db.commit()

    sub_names = {s.id: s.name for s in subtopics}
    return _attempt_out(attempt, questions, sub_names)


@router.get("/attempts/{attempt_id}", response_model=AttemptOut)
def get_attempt(attempt_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    attempt = db.get(TestAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(404, "unknown attempt")
    subs = db.query(Subtopic).filter(Subtopic.topic_id == attempt.topic_id).all()
    return _attempt_out(attempt, attempt.questions, {s.id: s.name for s in subs})


@router.post("/attempts/{attempt_id}/submit", response_model=AnalysisPayload)
def submit_attempt(attempt_id: int, body: SubmitIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    attempt = db.get(TestAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(404, "unknown attempt")
    if attempt.status == "submitted":
        raise HTTPException(409, "attempt already submitted")

    topic = db.get(Topic, attempt.topic_id)
    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == attempt.topic_id).all()
    questions = {q.id: q for q in attempt.questions}
    llm = get_llm()

    answered_ids = set()
    records: list[AnswerRecord] = []
    for ans in body.answers:
        q = questions.get(ans.question_id)
        if not q or ans.question_id in answered_ids:
            continue
        answered_ids.add(ans.question_id)
        correct, credit, feedback = grade_answer(llm, q, ans)
        records.append(AnswerRecord(
            attempt_id=attempt.id, question_id=q.id, subtopic_id=q.subtopic_id,
            response=ans.response, is_correct=correct, partial_credit=credit,
            feedback=feedback, time_taken_s=max(0.0, ans.time_taken_s),
        ))
    # unanswered questions (e.g. timer expired) count as wrong
    for qid, q in questions.items():
        if qid not in answered_ids:
            records.append(AnswerRecord(
                attempt_id=attempt.id, question_id=qid, subtopic_id=q.subtopic_id,
                response="", is_correct=False, partial_credit=0.0,
                feedback="Not answered before submission.", time_taken_s=0.0,
            ))
    db.add_all(records)

    payload = analyse(llm, topic, subtopics, attempt, list(questions.values()), records)

    attempt.status = "submitted"
    attempt.score = payload.score
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.llm_provider = llm.last_provider

    # update mastery: blend previous mastery with this attempt's per-subtopic accuracy
    sub_by_id = {s.id: s for s in subtopics}
    for r in payload.results:
        sub = sub_by_id.get(r.subtopicId)
        if sub and r.total > 0:
            accuracy = round(100 * r.correct / r.total)
            sub.mastery = round(0.6 * sub.mastery + 0.4 * accuracy)

    db.add(AnalysisResult(attempt_id=attempt.id, topic_id=topic.id, payload=payload.model_dump()))
    db.commit()
    return payload


@router.get("/attempts/{attempt_id}/analysis", response_model=AnalysisPayload)
def get_analysis(attempt_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    attempt = db.get(TestAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise HTTPException(404, "unknown attempt")
    row = db.query(AnalysisResult).filter(AnalysisResult.attempt_id == attempt_id).first()
    if not row:
        raise HTTPException(404, "no analysis for attempt")
    return AnalysisPayload(**row.payload)


@router.get("/topics/{topic_id}/latest-analysis", response_model=AnalysisPayload)
def latest_analysis(topic_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_topic(db, user, topic_id)
    row = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.topic_id == topic_id)
        .order_by(AnalysisResult.id.desc())
        .first()
    )
    if not row:
        raise HTTPException(404, "no analysis yet for topic")
    return AnalysisPayload(**row.payload)


# ─── Profile: stats, points, achievements ────────────────────────────────────
# KP (Knowledge Points) = sum of attempt scores. The full ledger-based points
# system arrives with the Tradecenter build (docs/PROMPT.md §2.7).

class AchievementOut(BaseModel):
    key: str
    name: str
    desc: str
    unlocked: bool

class ProfileOut(BaseModel):
    totalAttempts: int
    avgScore: int
    bestScore: int
    kp: int
    topicsExplored: int
    achievements: list[AchievementOut]


@router.get("/profile", response_model=ProfileOut)
def profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    attempts = (
        db.query(TestAttempt)
        .filter(TestAttempt.user_id == user.id, TestAttempt.status == "submitted")
        .all()
    )
    scores = [a.score for a in attempts]
    topics_explored = len({a.topic_id for a in attempts})
    kp = int(sum(scores))

    # improvement: any retake of a topic that beat the previous best
    improved = False
    best_seen: dict[str, float] = {}
    for a in sorted(attempts, key=lambda x: x.id):
        if a.topic_id in best_seen and a.score > best_seen[a.topic_id]:
            improved = True
        best_seen[a.topic_id] = max(best_seen.get(a.topic_id, 0), a.score)

    ach = [
        ("first-light", "First Light", "Take your first test.", len(attempts) >= 1),
        ("cartographer", "Cartographer", "Explore 3 different topic systems.", topics_explored >= 3),
        ("sharpshooter", "Sharpshooter", "Score 80+ on any test.", any(s >= 80 for s in scores)),
        ("ascension", "Ascension", "Beat your previous score on a retake.", improved),
        ("voyager", "Voyager", "Complete 5 tests.", len(attempts) >= 5),
        ("supernova", "Supernova", "Score a perfect 100.", any(s >= 100 for s in scores)),
    ]
    return ProfileOut(
        totalAttempts=len(attempts),
        avgScore=round(sum(scores) / len(scores)) if scores else 0,
        bestScore=round(max(scores)) if scores else 0,
        kp=kp,
        topicsExplored=topics_explored,
        achievements=[AchievementOut(key=k, name=n, desc=d, unlocked=u) for k, n, d, u in ach],
    )


# ─── Progress report (weekly / monthly / annual) ─────────────────────────────

class ProgressPoint(BaseModel):
    label: str
    avgScore: int | None   # None = no attempts in bucket
    attempts: int

class ProgressOut(BaseModel):
    period: str
    points: list[ProgressPoint]
    trend: int  # last-bucket avg minus first-nonempty-bucket avg (improvement signal)


@router.get("/progress", response_model=ProgressOut)
def progress(period: str = "weekly", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if period not in ("weekly", "monthly", "annual"):
        raise HTTPException(422, "period must be weekly | monthly | annual")
    now = datetime.now(timezone.utc)
    attempts = (
        db.query(TestAttempt)
        .filter(TestAttempt.user_id == user.id, TestAttempt.status == "submitted")
        .all()
    )

    def bucket_of(ts: datetime) -> int | None:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age = now - ts
        if period == "weekly":       # last 7 days, one bucket per day
            d = age.days
            return 6 - d if 0 <= d < 7 else None
        if period == "monthly":      # last 4 weeks, one bucket per week
            w = age.days // 7
            return 3 - w if 0 <= w < 4 else None
        m = (now.year - ts.year) * 12 + (now.month - ts.month)   # last 12 months
        return 11 - m if 0 <= m < 12 else None

    def label_of(i: int) -> str:
        if period == "weekly":
            return (now - timedelta(days=6 - i)).strftime("%a").upper()
        if period == "monthly":
            return f"W-{3 - i}"
        m = now.month - (11 - i)
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        return datetime(y, m, 1).strftime("%b").upper()

    n_buckets = {"weekly": 7, "monthly": 4, "annual": 12}[period]
    sums: dict[int, list[float]] = defaultdict(list)
    for a in attempts:
        if a.submitted_at is None:
            continue
        b = bucket_of(a.submitted_at)
        if b is not None:
            sums[b].append(a.score)

    points = [
        ProgressPoint(
            label=label_of(i),
            avgScore=round(sum(sums[i]) / len(sums[i])) if sums.get(i) else None,
            attempts=len(sums.get(i, [])),
        )
        for i in range(n_buckets)
    ]
    nonempty = [p.avgScore for p in points if p.avgScore is not None]
    trend = (nonempty[-1] - nonempty[0]) if len(nonempty) >= 2 else 0
    return ProgressOut(period=period, points=points, trend=trend)
