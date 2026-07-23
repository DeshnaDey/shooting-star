"""One-off migration: add `kp_balance_cached` to the shared `users` table.

Not Alembic - this repo doesn't use a migration framework (see
backend/scripts/migrate_add_coding_fields.py for the established pattern
this follows). Safe to run more than once; only adds the column if it isn't
already there.

Why this is needed: the `users` table already exists (created by backend),
and SQLAlchemy's create_all() only creates MISSING tables - it never alters
existing ones. So coupon-scraper's User model expecting kp_balance_cached
fails against the real table until this runs once.

Usage: python scripts/migrate_add_points_columns.py
"""
import os
import sys

# Ensure the coupon-scraper root (parent of this scripts/ folder) is on the
# path, so `from database import ...` resolves regardless of the working
# directory this is run from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, DATABASE_URL

COLUMNS = [
    ("kp_balance_cached", "INTEGER DEFAULT 0"),
]


def migrate_postgres() -> None:
    with engine.begin() as conn:
        for name, coltype in COLUMNS:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {coltype}"))
            print(f"added (or already present): users.{name}")


def migrate_sqlite() -> None:
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        for name, coltype in COLUMNS:
            if name in existing:
                print(f"already present: users.{name}")
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {coltype}"))
            print(f"added: users.{name}")


def main() -> None:
    if DATABASE_URL.startswith("sqlite"):
        migrate_sqlite()
    else:
        migrate_postgres()


if __name__ == "__main__":
    main()
