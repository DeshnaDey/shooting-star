from pydantic import BaseModel, Field

# ─── Topics ──────────────────────────────────────────────────────────────────

class SubtopicOut(BaseModel):
    id: str
    name: str
    blurb: str
    mastery: int

class TopicOut(BaseModel):
    id: str
    name: str
    tag: str
    blurb: str
    lit: bool = False       # True once at least one test has been completed
    progress: int = 0       # avg subtopic mastery 0-100
    subtopics: list[SubtopicOut]

# ─── Attempts ────────────────────────────────────────────────────────────────

class CreateAttemptIn(BaseModel):
    topic_id: str
    mode: str = Field(pattern="^(mcq|long_answer|flashcard|viva|coding)$")
    timed: bool = False
    num_questions: int = Field(default=6, ge=2, le=15)
    focus_subtopic_id: str | None = None

class QuestionOut(BaseModel):
    """Question as sent to the client — never includes the correct answer."""
    id: int
    subtopic_id: str
    subtopic_name: str
    qtype: str
    prompt: str
    choices: list[str] | None = None
    # flashcards get the back after flip; delivered upfront since self-graded
    flashcard_back: str | None = None
    # coding only
    starter_code: str | None = None
    language: str | None = None

class AttemptOut(BaseModel):
    id: int
    topic_id: str
    mode: str
    timed: bool
    time_limit_s: int
    status: str
    llm_provider: str
    questions: list[QuestionOut]

class AnswerIn(BaseModel):
    question_id: int
    response: str = ""
    self_correct: bool | None = None   # flashcard self-grade
    time_taken_s: float = 0.0

class SubmitIn(BaseModel):
    answers: list[AnswerIn]

# ─── Analysis payload (mirrors apps/web/src/data/analysis.ts shapes) ─────────

class SubtopicResult(BaseModel):
    subtopicId: str
    name: str
    correct: float
    total: int

class ConceptFrame(BaseModel):
    note: str
    values: list[float]
    highlights: list[int] = []
    merged: list[int] = []

class WeakConcept(BaseModel):
    subtopicId: str
    name: str
    aiDiagnosis: str
    wrongAnswerPattern: str
    frames: list[ConceptFrame]

class GradedAnswer(BaseModel):
    questionId: int
    prompt: str
    response: str
    correct: bool
    partialCredit: float
    feedback: str

class AnalysisPayload(BaseModel):
    topicId: str
    attemptId: int
    attemptLabel: str
    score: int
    timeTaken: str
    mode: str
    provider: str
    results: list[SubtopicResult]
    weak: list[WeakConcept]
    answers: list[GradedAnswer]
