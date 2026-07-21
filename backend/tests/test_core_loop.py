"""End-to-end tests: auth, per-user scoping, core test loop, concept decks.
Runs with the mock LLM provider and a throwaway SQLite DB.

Env + the shared session-scoped ``client`` fixture live in ``conftest.py``."""

import pytest


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/register", json={
        "name": "Deshna", "email": "deshna@example.com", "password": "supersecret1",
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health(client):
    assert client.get("/health").status_code == 200


# ─── Auth ────────────────────────────────────────────────────────────────────

def test_auth_flow(client, auth):
    # protected routes reject anonymous + bad tokens
    assert client.get("/api/topics").status_code in (401, 403)
    assert client.get("/api/topics", headers={"Authorization": "Bearer junk"}).status_code == 401

    # duplicate email blocked
    r = client.post("/api/auth/register", json={
        "name": "X", "email": "deshna@example.com", "password": "whatever123",
    })
    assert r.status_code == 409

    # login works, wrong password rejected
    assert client.post("/api/auth/login", json={
        "email": "deshna@example.com", "password": "supersecret1"}).status_code == 200
    assert client.post("/api/auth/login", json={
        "email": "deshna@example.com", "password": "wrong"}).status_code == 401

    # me endpoint
    me = client.get("/api/auth/me", headers=auth).json()
    assert me == {"name": "Deshna", "email": "deshna@example.com"}

    # weak inputs rejected
    assert client.post("/api/auth/register", json={
        "name": "Y", "email": "not-an-email", "password": "supersecret1"}).status_code == 422
    assert client.post("/api/auth/register", json={
        "name": "Y", "email": "y@example.com", "password": "short"}).status_code == 422


# ─── Topics ──────────────────────────────────────────────────────────────────

def test_sky_starts_empty(client, auth):
    assert client.get("/api/topics", headers=auth).json() == []


def test_create_topic(client, auth):
    r = client.post("/api/topics", data={"name": "Sorting Algorithms"}, headers=auth)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["id"] == "sorting-algorithms"
    assert len(t["subtopics"]) >= 2
    assert t["lit"] is False and t["progress"] == 0


def test_topics_are_private(client, auth):
    r = client.post("/api/auth/register", json={
        "name": "Other", "email": "other@example.com", "password": "password123",
    })
    other = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/topics", headers=other).json() == []  # other user's sky is empty
    # and they can't touch the first user's topic
    assert client.post("/api/attempts", json={
        "topic_id": "sorting-algorithms", "mode": "mcq"}, headers=other).status_code == 404


# ─── Core loop ───────────────────────────────────────────────────────────────

def test_full_mcq_loop(client, auth):
    topic = client.post("/api/topics", data={"name": "Operating Systems"}, headers=auth).json()
    r = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "mcq", "timed": True, "num_questions": 6,
    }, headers=auth)
    assert r.status_code == 200, r.text
    attempt = r.json()
    assert attempt["time_limit_s"] == 6 * 45
    assert len(attempt["questions"]) == 6
    assert "correct_index" not in attempt["questions"][0]

    answers = [
        {"question_id": q["id"], "response": "1", "time_taken_s": 5}
        for q in attempt["questions"][:3]
    ]
    r = client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth)
    assert r.status_code == 200, r.text
    analysis = r.json()
    assert analysis["score"] == 50
    assert analysis["weak"]

    assert client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth).status_code == 409
    assert client.get(f"/api/attempts/{attempt['id']}/analysis", headers=auth).status_code == 200
    assert client.get(f"/api/topics/{topic['id']}/latest-analysis", headers=auth).status_code == 200

    # topic now lit for this user
    topics = {t["id"]: t for t in client.get("/api/topics", headers=auth).json()}
    assert topics[topic["id"]]["lit"] is True


def test_flashcard_and_long_answer(client, auth):
    topic = client.post("/api/topics", data={"name": "Machine Learning"}, headers=auth).json()
    attempt = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "flashcard", "num_questions": 4}, headers=auth).json()
    assert all(q["flashcard_back"] for q in attempt["questions"])
    answers = [{"question_id": q["id"], "self_correct": i % 2 == 0} for i, q in enumerate(attempt["questions"])]
    assert client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth).json()["score"] == 50

    attempt = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "long_answer", "num_questions": 2}, headers=auth).json()
    answers = [
        {"question_id": attempt["questions"][0]["id"],
         "response": "A detailed multi-sentence explanation of the mechanism covering steps, complexity, and a pitfall in practice for partial credit."},
        {"question_id": attempt["questions"][1]["id"], "response": ""},
    ]
    graded = client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth).json()["answers"]
    assert graded[0]["partialCredit"] > 0
    assert next(a for a in graded if a["response"] == "")["partialCredit"] == 0


def test_viva_and_coding(client, auth):
    topic = client.post("/api/topics", data={"name": "Databases"}, headers=auth).json()

    attempt = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "viva", "num_questions": 3}, headers=auth).json()
    assert len(attempt["questions"]) == 3
    for q in attempt["questions"]:
        assert q["qtype"] == "viva"
        assert q["starter_code"] is None and q["language"] is None
    answers = [
        {"question_id": attempt["questions"][0]["id"],
         "response": "A thorough spoken explanation covering the mechanism, its complexity, and a real pitfall."},
        {"question_id": attempt["questions"][1]["id"], "response": ""},
    ]
    graded = client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth).json()["answers"]
    assert graded[0]["partialCredit"] > 0
    assert next(a for a in graded if a["response"] == "")["partialCredit"] == 0

    attempt = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "coding", "num_questions": 3}, headers=auth).json()
    assert attempt["time_limit_s"] == 0  # untimed by default
    for q in attempt["questions"]:
        assert q["qtype"] == "coding"
        assert q["starter_code"]
        assert q["language"]
    answers = [
        {"question_id": attempt["questions"][0]["id"],
         "response": "def solve(data):\n    # sort the input list in ascending order and return it\n    return sorted(data)"},
        {"question_id": attempt["questions"][1]["id"], "response": ""},
    ]
    graded = client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth).json()["answers"]
    assert graded[0]["partialCredit"] > 0
    assert next(a for a in graded if a["response"] == "")["partialCredit"] == 0


# ─── Concept decks ───────────────────────────────────────────────────────────

def test_concept_deck(client, auth):
    topic = client.get("/api/topics", headers=auth).json()[0]
    sid = topic["subtopics"][0]["id"]
    r = client.get(f"/api/subtopics/{sid}/concept", headers=auth)
    assert r.status_code == 200, r.text
    deck = r.json()
    slides = deck["slides"]
    assert 2 <= len(slides) <= 6
    assert slides[0]["kind"] == "mindmap"                       # guardrail: mindmap leads
    mm = slides[0]
    assert 2 <= len(mm["branches"]) <= 6
    for b in mm["branches"]:
        assert len(b["label"].split()) <= 6                     # pointers, not sentences
        assert 1 <= len(b["children"]) <= 5
    for s in slides:
        if s["kind"] == "definition":
            for t in s["terms"]:
                assert t["term"] and t["formal"] and t["simple"]
                assert len(t["simple"].split()) <= 30
        if s["kind"] == "flow":
            ids = {n["id"] for n in s["nodes"]}
            assert all(e["from"] in ids and e["to"] in ids for e in s["edges"])
        if s["kind"] == "animation":
            assert 2 <= len(s["frames"]) <= 10
    # cached second time
    assert client.get(f"/api/subtopics/{sid}/concept", headers=auth).json()["cached"] is True
    assert client.get("/api/subtopics/nope/concept", headers=auth).status_code == 404


# ─── Profile & progress (user-scoped) ────────────────────────────────────────

def test_profile_and_progress(client, auth):
    p = client.get("/api/profile", headers=auth).json()
    assert p["totalAttempts"] >= 3
    assert p["kp"] > 0
    ach = {a["key"]: a["unlocked"] for a in p["achievements"]}
    assert ach["first-light"] is True

    for period, buckets in (("weekly", 7), ("monthly", 4), ("annual", 12)):
        d = client.get(f"/api/progress?period={period}", headers=auth).json()
        assert len(d["points"]) == buckets
        assert d["points"][-1]["attempts"] >= 1

    # a fresh user sees zero of it
    r = client.post("/api/auth/register", json={
        "name": "Fresh", "email": "fresh@example.com", "password": "password123"})
    fresh = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/profile", headers=fresh).json()["totalAttempts"] == 0


# ─── Regenerate subtopics ─────────────────────────────────────────────────────

def test_regenerate_subtopics(client, auth):
    topic = client.post("/api/topics", data={"name": "Graph Theory"}, headers=auth).json()

    attempt = client.post("/api/attempts", json={
        "topic_id": topic["id"], "mode": "mcq", "num_questions": 2}, headers=auth).json()
    answers = [{"question_id": q["id"], "response": "1", "time_taken_s": 1} for q in attempt["questions"]]
    submit = client.post(f"/api/attempts/{attempt['id']}/submit", json={"answers": answers}, headers=auth)
    assert submit.status_code == 200, submit.text

    r = client.post(f"/api/topics/{topic['id']}/regenerate-subtopics", headers=auth)
    assert r.status_code == 200, r.text
    regenerated = r.json()
    assert regenerated["id"] == topic["id"]
    assert all(s["mastery"] == 0 for s in regenerated["subtopics"])
    assert len(regenerated["subtopics"]) >= 2

    # the previously submitted attempt's analysis is still fetchable (JSON snapshot, no live join)
    analysis = client.get(f"/api/attempts/{attempt['id']}/analysis", headers=auth)
    assert analysis.status_code == 200, analysis.text

    # other users cannot regenerate someone else's topic
    r = client.post("/api/auth/register", json={
        "name": "Nosey", "email": "nosey@example.com", "password": "password123"})
    nosey = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.post(f"/api/topics/{topic['id']}/regenerate-subtopics", headers=nosey).status_code == 404
