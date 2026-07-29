# Shooting Star — Project Memory & Rebuild Reference

> A durable, self-contained description of the whole system, its data contracts,
> and how the lost pieces were recovered — so the project can be rebuilt from
> scratch if files are ever lost again. Keep this committed to git.

Last consolidated: 2026-07-22. Canonical working copy: `~/dev/shooting-star`
(GitHub `DeshnaDey/shooting-star`, `main`). A redundant copy previously lived at
`~/Desktop/Projects/VSC/shooting-star` and was removed.

---

## 1. What the product is

Shooting Star is a space-themed learning app. A user's topics are **stars** in a
**constellation**; each topic's subtopics are **planets** in a **solar system**.
The learner takes AI-generated **tests**, gets an AI **concept visualizer**, plays
a **Knowledge Arcade** of word games built from a studied topic, and spends earned
Knowledge Points (KP) in a **Tradecenter** backed by a separate coupon-scraper
service.

Main sections (sidebar order): **Constellation → Arcade → Tradecenter → Profile**.

---

## 2. Architecture

- **Frontend** — React 18 + Vite + TypeScript; 3D via `three` + `@react-three/fiber`
  + `@react-three/drei`; routing via `react-router-dom`; charts via `recharts`.
  Dir: `frontend/`. Entry `src/main.tsx` → `src/App.tsx` (routes + global chrome).
- **Backend (API)** — FastAPI + SQLAlchemy 2.0; dir `backend/`. Entry
  `app/main.py` (creates tables on startup via `Base.metadata.create_all`, mounts
  `app/api/routes.py`). LLM adapter with graceful mock fallback.
- **Coupon-scraper service** — separate FastAPI app in `services/coupon-scraper/`,
  own port (8001), shares the JWT secret. Powers Tradecenter rewards/redemptions.
- **Database** — SQLAlchemy engine from `DATABASE_URL`. Currently **Supabase
  Postgres** (`postgresql+psycopg://…`); falls back to local SQLite if unset.
  `psycopg` v3 is the driver. `app/db/session.py` uses `connect_timeout=10` +
  `pool_pre_ping` for non-sqlite so a blocked DB fails fast instead of hanging.
- **LLM** — `app/services/llm.py`. `OllamaProvider` (OpenAI-compatible
  `/v1/chat/completions`, JSON mode) or `MockProvider` (deterministic, offline).
  `FallbackLLM` tries the primary and silently falls back to mock on failure, so
  the demo always works. Every call site uses `complete_json()`.

### Environment (`backend/.env`, gitignored — never commit)
- `DATABASE_URL` — Supabase Session-pooler URI, `postgresql+psycopg://…`
  (password is URL-encoded, e.g. `@`→`%40`).
- `LLM_PROVIDER` = `ollama` | `mock`; `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`,
  `OLLAMA_MODEL` (e.g. `gpt-oss:20b` on Ollama Cloud).
- `CORS_ORIGINS`, `JWT_SECRET`, `JWT_EXPIRY_DAYS`.
- `frontend/.env`: `VITE_API_BASE_URL=http://localhost:8000`.

### Run
```
# backend
cd backend && python -m uvicorn app.main:app --reload --reload-dir app --port 8000
# frontend
cd frontend && npm install && npm run dev        # http://localhost:5173
# coupon service (optional, for Tradecenter)
cd services/coupon-scraper && python -m uvicorn main:app --reload --port 8001
```

---

## 3. Data model (`backend/app/models/models.py`)

`User`, `Topic` (id str, user_id, name, tag, blurb, subtopics), `Subtopic`
(id, topic_id, name, blurb, mastery 0-100), `TestAttempt`, `Question`
(mcq/long_answer/flashcard/viva/coding; has `starter_code`,`language` for coding),
`AnswerRecord`, `AnalysisResult`, `ConceptMap` (cached visualizer payload),
and **`ArcadePuzzle`** (cached arcade bundle: `topic_id` unique, `provider`,
`payload` JSON `{topicId,wordle,spellingbee,crossword,strands}`, `created_at`).

Fresh Postgres gets all tables + columns automatically via `create_all`. For an
old SQLite missing the coding columns there's `backend/scripts/migrate_add_coding_fields.py`.

---

## 4. Core API routes (`backend/app/api/routes.py`, prefix `/api`)

Auth: `POST /auth/register|login`, `GET /auth/me`.
Topics: `GET /topics`; **`POST /topics` is multipart form** (`name` Form field,
optional `syllabus` File, `use_internet` Form bool) — the frontend MUST send
`FormData`, not JSON (see §6). `POST /topics/{id}/regenerate-subtopics`.
Concept: `GET /subtopics/{id}/concept`.
Attempts: `POST /attempts`, `GET /attempts/{id}`, `POST /attempts/{id}/submit`,
`GET /attempts/{id}/analysis`, `GET /topics/{id}/latest-analysis`.
Profile/Progress: `GET /profile`, `GET /progress?period=weekly|monthly|annual`.
**Arcade:** `GET /arcade/wordlist`, `GET /arcade/{topic_id}?refresh=bool`,
`POST /arcade/{topic_id}/score` (body `{game,score,time_s}` → `{game,rank,leaderboard}`).

---

## 5. Knowledge Arcade (a culmination of NYT + LinkedIn mini-games)

Words for each game come from a **studied topic (a star)**. The LLM writes a
themed **word bank**; Python assembles the games deterministically so a weak/offline
model can never produce an invalid grid. Ranking is timed with a hardcoded
friend-leaderboard (Indian names) + "friends notified" hook.

**Backend**
- `services/arcade_generation.py`: `build_word_bank(llm, topic, subtopics)` →
  validated `[{word,clue,subtopic}]` (system prompt tag `TASK:arcade_wordbank`;
  4-8 letter real words; clue must not contain the word). `get_arcade(db, llm,
  topic, subtopics, refresh)` get-or-builds the cached `ArcadePuzzle`.
- `services/arcade_puzzles.py`: `build_puzzles(bank, topic_id, topic_name)` — pure,
  seeded by `crc32(topic_id)`. Builds:
  - **wordle**: `{answer(5,upper,alpha),clue,subtopic}`, fallback word `LEARN`.
  - **spellingbee**: `{letters[7 distinct],center,answers(≥3, each ⊆ letters,
    contains center, len≥4),pangrams}` — uses bundled `_COMMON` word list.
  - **crossword**: greedy interlocking, `{rows,cols,entries:[{answer,clue,subtopic,
    row,col,dir(across|down),num}]}`, cap 22 words, `_MAX_DIM=13`.
  - **strands (Sprangle)**: 10×10 word-search, `{rows,cols,grid[str],theme,words,
    placements:[{word,clue,subtopic,cells:[[r,c]]}]}`.
- `services/wordle_words.py`: loads `backend/app/data/wordle_words.txt`
  (~10k valid 5-letter guesses) into `WORDLE_WORDS`.
- `MockProvider._arcade_wordbank` in `llm.py` fabricates a valid offline bank.
- Leaderboard: hardcoded `_ARCADE_LEADERS` (Aarav, Priya, Rohan, Ananya, Vikram,
  Diya, Karthik); the user's score is inserted, sorted desc, rank computed, entry
  flagged `you:true`.
- Tests: `backend/tests/test_arcade.py` pins the exact bundle/leaderboard contract.

**Frontend** (`frontend/src/`)
- `pages/ArcadePage.tsx`: opened from the **sidebar** (`/arcade`) → **star picker**
  (studied stars first) → `?topic=<id>` loads that topic; also reachable per-system
  at `/system/:starId/arcade`. Game tabs, leaderboard modal, "NEW PUZZLES" reroll,
  pixel HUD/decor/astronaut, `NebulaDrift`.
- `components/arcade/{WordleGame,SpellingBeeGame,CrosswordGame,StrandsGame}.tsx` —
  each reveals its solution on finish and reports a score via `onComplete`.
- `lib/api.ts`: `arcade`, `arcadeWordlist`, `arcadeScore` + Arcade* types.

---

## 6. The topic-creation fix (important)

`POST /api/topics` is a **multipart form** endpoint. `lib/api.ts#createTopic`
therefore builds `FormData` (`form.append("name", name)`) and fetches WITHOUT the
JSON `Content-Type` header (so the browser sets the multipart boundary). Sending
JSON here returns 422 "field required" and the constellation can't add topics.

---

## 7. Space theme (dynamic, per-page, but one coherent space aesthetic)

- `components/SpaceFX.tsx` (mounted globally in `App`): a persistent `space-backdrop`
  (rainbow haze), a `page-hue` layer whose colour = the route's accent (`routeHue`:
  trade=blue, profile=gold, arcade=lilac, concept=teal, test=magenta, analysis=blue,
  login/default=purple), and on every click a **click-orb** that expands from the
  pointer to *become* the page background hue (keeping stars/haze visible) plus
  **shooting stars** radiating from the click point.
- `components/three/NebulaField.tsx`: colourful nebula clouds spread **evenly** on a
  jittered 6×4 grid across the whole backdrop (8-colour palette) + `makeNebulaTexture`
  (wispy canvas texture). Used on the Constellation and SolarSystem 3D scenes.
- `components/NebulaDrift.tsx`: DOM drifting-nebula layer for non-3D pages
  (`variant` prop). `components/RainbowHaze.tsx`: stardust halo behind Login &
  Tradecenter panels. `components/SpaceLoader.tsx`: planet-orbit loader.
- `components/PixelArt.tsx`: `PixelHud` (level/coins/lives), `PixelDecor`,
  `ArcadeAstronaut` — pixel-art accents for the arcade.
- Star-zoom: clicking a topic star on the Constellation plays a white-flash then
  navigates into that system.
- Design tokens (colours, fonts, HUD classes) live in `frontend/src/styles/global.css`.

---

## 8. Concept Visualizer (was never lost — survived on disk)

- `backend/app/services/scene_animations.py` — 24+ hand-authored keyframed "scene"
  diagrams (DNA→RNA→protein, Bohr atom, BFS/DFS, photosynthesis, unit circle, …).
  Elements keep ids across frames so they slide/bind/fade.
- `concept_visualization.py` + `algorithm_animations.py` build the deck; injected
  after the mindmap. `frontend/src/components/ScenePlayer.tsx` renders scene frames;
  `ConceptVideo.tsx` narrates them.

---

## 9. How the lost work was recovered (recovery playbook)

The loss was caused by `git reset --hard origin/main`, which discards **uncommitted**
work. What survived and how it was brought back:
1. **Backend Python** — the `.py` sources were gone but compiled `.pyc` remained in
   `__pycache__` (gitignored, so not reset). Recovered by decompiling with
   **Decompyle++ (`pycdc`)**, which handles CPython 3.10 bytecode (built from
   source with `g++`; `decompyle3`/`uncompyle6` do NOT support 3.10). Decompiled
   output has artifacts (list-comprehensions as lambdas, lost module refs, incomplete
   fns) that must be repaired; the recovered tests (`test_arcade.pyc`) pinned the
   exact contract to verify against.
2. **Frontend `.tsx`** — no bytecode, and VS Code Local History had nothing for this
   project (files were written externally, not saved through the editor), so the
   arcade UI and space theme were **reconstructed** from the chat records + the
   recovered backend contracts.
3. **`wordle_words.txt`** — regenerated (~10k 5-letter words) from an English word set.

**Lesson / guard:** commit early and often. Before any `git pull`/`reset`, ensure
`git status` is clean (or `git stash`/commit first). Uncommitted work has no safety net.

---

## 10. File map (source, non-generated)

```
backend/app/
  main.py  core/{config,security}.py  db/session.py  api/routes.py
  models/models.py  schemas/schemas.py
  services/{llm, topic_design, quiz_generation, grading, answer_analysis,
            concept_visualization, scene_animations, algorithm_animations,
            arcade_generation, arcade_puzzles, wordle_words, file_parser, web_search}.py
  data/wordle_words.txt
backend/tests/{test_core_loop, test_arcade}.py   backend/scripts/migrate_add_coding_fields.py
frontend/src/
  App.tsx  main.tsx  styles/global.css  lib/{api,visuals}.ts
  components/{Sidebar, Hud, SpaceFX, NebulaDrift, RainbowHaze, SpaceLoader, PixelArt,
             ConceptPlayer, ConceptVideo, ScenePlayer, SlideViews}.tsx
  components/three/{NebulaField.tsx, helpers.ts}
  components/arcade/{WordleGame, SpellingBeeGame, CrosswordGame, StrandsGame}.tsx
  pages/{Login, Constellation, SolarSystem, Test, Visualiser, Concept, Arcade,
         Tradecenter, Profile}Page.tsx
services/coupon-scraper/  (separate FastAPI app: rewards, redemptions, KP ledger)
docs/{PROMPT.md, architecture.md, api-spec.md, README.md, PROJECT_MEMORY.md}
```
