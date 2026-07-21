# backend — Shooting Star backend

FastAPI + SQLAlchemy. LLM via any OpenAI-compatible endpoint (Ollama local/cloud) with deterministic mock fallback.

    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload    # http://localhost:8000  (docs at /docs)

Config via backend/.env — see /.env.example. Tests: python3 -m pytest
