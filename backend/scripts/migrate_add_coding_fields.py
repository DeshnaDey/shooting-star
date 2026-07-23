"""One-off migration: add the `starter_code` and `language` columns to `questions`.

Not Alembic — this repo doesn't use a migration framework, so this is a small,
re-runnable script instead. Safe to run more than once; it only adds a column
if it isn't already there.

Usage: python scripts/migrate_add_coding_fields.py
"""

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine

COLUMNS = [
    ("starter_code", "TEXT"),
    ("language", "VARCHAR(30)"),
]


def migrate_postgres() -> None:
    with engine.begin() as conn:
        for name, coltype in COLUMNS:
            conn.execute(text(f"ALTER TABLE questions ADD COLUMN IF NOT EXISTS {name} {coltype}"))
            print(f"added (or already present): questions.{name}")


def migrate_sqlite() -> None:
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(questions)"))}
        for name, coltype in COLUMNS:
            if name in existing:
                print(f"already present: questions.{name}")
                continue
            conn.execute(text(f"ALTER TABLE questions ADD COLUMN {name} {coltype}"))
            print(f"added: questions.{name}")


def main() -> None:
    settings = get_settings()
    if settings.database_url.startswith("sqlite"):
        migrate_sqlite()
    else:
        migrate_postgres()


if __name__ == "__main__":
    main()
