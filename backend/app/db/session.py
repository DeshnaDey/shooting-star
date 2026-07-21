from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(settings.database_url, connect_args=connect_args)
else:
    # Fail fast instead of hanging forever if the DB (e.g. Supabase) is
    # unreachable — a blocked port 5432 otherwise stalls startup indefinitely.
    connect_args = {"connect_timeout": 10}
    engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
