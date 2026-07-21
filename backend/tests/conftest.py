"""Shared test setup: mock LLM, one throwaway SQLite DB, a session-scoped client.

Centralising this here (rather than per-module) means multiple test files share a
single engine/DB for the whole run — the app's settings/engine are built once at
import, so every test module must agree on the same DATABASE_URL.
"""

import os

os.environ.setdefault("LLM_PROVIDER", "mock")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_shooting_star.db")
os.environ.setdefault("JWT_SECRET", "test-secret-key-at-least-32-bytes-long!")

import pytest
from fastapi.testclient import TestClient

from app.main import app

_DB_FILE = "test_shooting_star.db"


@pytest.fixture(scope="session")
def client():
    if os.path.exists(_DB_FILE):
        os.remove(_DB_FILE)
    with TestClient(app) as c:
        yield c
    if os.path.exists(_DB_FILE):
        os.remove(_DB_FILE)
