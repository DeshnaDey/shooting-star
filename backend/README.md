# backend — Shooting Star backend

FastAPI + SQLAlchemy. LLM via any OpenAI-compatible endpoint (Ollama local/cloud) with deterministic mock fallback.

    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload    # http://localhost:8000  (docs at /docs)

Config via backend/.env — see /.env.example. Tests: python3 -m pytest

## Migrations

This repo doesn't use Alembic, and `create_all()` only creates missing tables —
it will not retroactively alter columns on tables that already exist in a live
database (e.g. Supabase). After pulling a change that adds/changes columns, run
the matching one-off script once before starting the server, e.g.:

    python scripts/migrate_add_coding_fields.py
