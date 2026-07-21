from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    tag: Mapped[str] = mapped_column(String(60))
    blurb: Mapped[str] = mapped_column(Text, default="")
    subtopics: Mapped[list["Subtopic"]] = relationship(back_populates="topic", cascade="all, delete-orphan")


class Subtopic(Base):
    __tablename__ = "subtopics"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"))
    name: Mapped[str] = mapped_column(String(120))
    blurb: Mapped[str] = mapped_column(Text, default="")
    mastery: Mapped[int] = mapped_column(Integer, default=0)  # 0-100, updated after attempts
    topic: Mapped[Topic] = relationship(back_populates="subtopics")


class TestAttempt(Base):
    __tablename__ = "test_attempts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"))
    mode: Mapped[str] = mapped_column(String(20))          # mcq | long_answer | flashcard
    timed: Mapped[bool] = mapped_column(Boolean, default=False)
    time_limit_s: Mapped[int] = mapped_column(Integer, default=0)
    focus_subtopic_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress | submitted
    score: Mapped[float] = mapped_column(Float, default=0.0)
    llm_provider: Mapped[str] = mapped_column(String(20), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    questions: Mapped[list["Question"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")
    answers: Mapped[list["AnswerRecord"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("test_attempts.id"))
    subtopic_id: Mapped[str] = mapped_column(String(40))
    qtype: Mapped[str] = mapped_column(String(20))         # mcq | long_answer | flashcard
    prompt: Mapped[str] = mapped_column(Text)
    choices: Mapped[list | None] = mapped_column(JSON, nullable=True)   # mcq only
    correct_index: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mcq only (never sent to client)
    reference_answer: Mapped[str] = mapped_column(Text, default="")     # long_answer rubric / flashcard back
    explanation: Mapped[str] = mapped_column(Text, default="")
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)   # coding only
    language: Mapped[str | None] = mapped_column(String(30), nullable=True)  # coding only
    attempt: Mapped[TestAttempt] = relationship(back_populates="questions")


class AnswerRecord(Base):
    __tablename__ = "answer_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("test_attempts.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    subtopic_id: Mapped[str] = mapped_column(String(40))
    response: Mapped[str] = mapped_column(Text, default="")
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    partial_credit: Mapped[float] = mapped_column(Float, default=0.0)   # 0-1
    feedback: Mapped[str] = mapped_column(Text, default="")
    time_taken_s: Mapped[float] = mapped_column(Float, default=0.0)
    attempt: Mapped[TestAttempt] = relationship(back_populates="answers")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("test_attempts.id"), unique=True)
    topic_id: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)   # full AnalysisPayload (results, weak concepts, frames)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ConceptMap(Base):
    """Cached AI-generated concept visualisation (flowchart notes + optional animation)."""
    __tablename__ = "concept_maps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subtopic_id: Mapped[str] = mapped_column(String(80), unique=True)
    provider: Mapped[str] = mapped_column(String(20), default="mock")
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
