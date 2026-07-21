"""Knowledge Arcade tests: bundle generation (mock LLM), puzzle validity, caching,
and the hardcoded leaderboard / friend-notification hook.

Env + the shared session-scoped ``client`` fixture live in ``conftest.py``."""

import pytest


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/register", json={
        "name": "Deshna Dey", "email": "arcade@example.com", "password": "supersecret1",
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def topic(client, auth):
    return client.post("/api/topics", data={"name": "Graph Theory"}, headers=auth).json()


def test_arcade_bundle_shape(client, auth, topic):
    r = client.get(f"/api/arcade/{topic['id']}", headers=auth)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["topicId"] == topic["id"]
    assert b["cached"] is False
    for game in ("wordle", "spellingbee", "crossword", "strands"):
        assert game in b

    # wordle: a real 5-letter answer with a clue and a source star
    w = b["wordle"]
    assert len(w["answer"]) == 5 and w["answer"].isalpha() and w["answer"].isupper()
    assert w["clue"] and w["subtopic"]

    # spelling bee: 7 distinct letters, a centre that is one of them, playable answers
    bee = b["spellingbee"]
    assert len(bee["letters"]) == 7 and len(set(bee["letters"])) == 7
    assert bee["center"] in bee["letters"]
    assert len(bee["answers"]) >= 3
    for ans in bee["answers"]:
        assert set(ans) <= set(bee["letters"]) and bee["center"] in ans and len(ans) >= 4

    # crossword: every entry fits the grid and interlocks (>=2 entries)
    cw = b["crossword"]
    assert len(cw["entries"]) >= 2
    filled = {}
    for e in cw["entries"]:
        assert e["dir"] in ("across", "down")
        for i, ch in enumerate(e["answer"]):
            rr = e["row"] + (i if e["dir"] == "down" else 0)
            cc = e["col"] + (i if e["dir"] == "across" else 0)
            assert 0 <= rr < cw["rows"] and 0 <= cc < cw["cols"]
            if (rr, cc) in filled:
                assert filled[(rr, cc)] == ch     # crossings must agree
            filled[(rr, cc)] = ch

    # strands: every listed word is actually placed on straight lines in the grid
    st = b["strands"]
    grid = st["grid"]
    assert len(grid) == st["rows"] and all(len(row) == st["cols"] for row in grid)
    for p in st["placements"]:
        letters = "".join(grid[r][c] for r, c in p["cells"])
        assert letters == p["word"]


def test_arcade_is_cached(client, auth, topic):
    assert client.get(f"/api/arcade/{topic['id']}", headers=auth).json()["cached"] is True
    # refresh rebuilds
    assert client.get(f"/api/arcade/{topic['id']}?refresh=true", headers=auth).json()["cached"] is False


def test_arcade_score_leaderboard(client, auth, topic):
    r = client.post(f"/api/arcade/{topic['id']}/score", headers=auth,
                    json={"game": "wordle", "score": 100000, "time_s": 42.0})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["rank"] == 1                                  # a perfect score wins
    assert out["leaderboard"][0]["you"] is True
    assert sum(1 for row in out["leaderboard"] if row["you"]) == 1
    scores = [row["score"] for row in out["leaderboard"]]
    assert scores == sorted(scores, reverse=True)            # sorted high -> low
    assert len(out["notified"]) == 3


def test_arcade_wordlist(client, auth):
    r = client.get("/api/arcade/wordlist", headers=auth)
    assert r.status_code == 200, r.text
    words = r.json()["words"]
    assert len(words) > 5000                         # a real dictionary, not a stub
    assert all(len(w) == 5 and w.isalpha() for w in words[:50])


def test_arcade_requires_ownership(client, auth, topic):
    other = client.post("/api/auth/register", json={
        "name": "Nosey", "email": "nosey-arcade@example.com", "password": "supersecret1",
    }).json()
    h = {"Authorization": f"Bearer {other['token']}"}
    assert client.get(f"/api/arcade/{topic['id']}", headers=h).status_code == 404
