# Constellation Learning — Build Prompt

Use this document as the spec when implementing the app. It assumes the repo skeleton in this project (apps/web, apps/api, services/coupon-scraper, packages, infra) and the existing frontend design prototype ("Design Constellation AI Dashboard" — Figma Make export) as the starting point for `apps/web`.

## 1. What this is

Constellation Learning is a full-stack, space/constellation-themed adaptive learning platform. A student picks a topic they're struggling with, takes a test on it, and the app tells them *exactly* which sub-concept they're weak on — then opens a purpose-built interactive visualizer for that sub-concept so they can actually understand it, not just see a percentage. Progress is tracked as a "galaxy" of mastered/learning/locked topics, and testing well earns Knowledge Points (KP) that can be spent on real-world coupon rewards (sourced by a background web scraper) or cosmetic app customizations.

Two feature pillars, from the product owner directly:

1. **Test → Analysis → Visualize → Retest loop.** Student searches a topic, takes a test (MCQ, long-answer, flashcard, or timed — all four modes must exist and be combinable, e.g. "timed MCQ"). After submission, an analysis step identifies which *specific* sub-concept the student is weak on (not just "sorting algorithms" but "merge sort" specifically, if that's where the wrong answers clustered). That triggers a dedicated Visualizer tab/experience for that exact sub-concept. The student can retake the test to improve.
2. **Points → Rewards loop.** Test performance earns points. Points can be redeemed for coupon codes that a web scraper has found and verified on the internet, in exchange for a set number of points.

## 2. Feature spec

### 2.1 Auth & profile
Email/password + OAuth (Google) via Auth0 or a self-hosted JWT flow (pick one — Auth0 is in the reference architecture). Profile holds KP balance, level, streak, and per-topic mastery.

### 2.2 Topic search (Galaxy home)
Landing page ("Galaxy") lets the student search or browse topics. Search should hit both a syllabus/topic index and fuzzy-match against ingested course material (see 3.3). Selecting a topic shows current mastery and a "take a test" CTA.

### 2.3 Test engine — all four modes required
- **MCQ** — single-select, auto-graded.
- **Long-answer** — free-text response, graded by an LLM rubric against the reference answer/concept, with partial credit and a brief explanation of what was missing.
- **Flashcard** — self-paced front/back recall; student self-grades "got it / missed it" (used for spaced-repetition scheduling, not just one-off scoring).
- **Timed** — a modifier, not a separate question type: any of the above three can be run under a countdown, either per-question or for the whole set. The test setup screen must let the student choose topic → mode → (timed on/off) → length/difficulty before starting.

Every question must be tagged at two levels: **topic** (e.g. "Sorting Algorithms") and **sub-concept** (e.g. "Merge Sort", "Quick Sort", "Bubble Sort", "Time Complexity of Sorts"). This tagging is what makes weak-point analysis possible — do not generate or store a question without a sub-concept tag.

### 2.4 Post-test analysis
After submission, run an analysis pass over the `AnswerRecord`s for that attempt:
- Group wrong/partial answers by sub-concept tag.
- Flag a sub-concept as a **weak point** if the student got a majority of that sub-concept's questions wrong (or fully wrong on long-answer), with a minimum sample size (e.g. ≥2 questions on that sub-concept) to avoid false positives on a single unlucky question.
- Produce a ranked list of weak sub-concepts plus a plain-language explanation per sub-concept (LLM-generated) of *why* the answers were wrong (e.g. "You correctly identify merge sort's divide step but consistently misplace the merge step's comparison order").
- Persist this as an `AnalysisResult` linked to the `TestAttempt`, and update the student's mastery graph.

Example from the product owner: a test on "Sorting Algorithms" comes back with "Merge Sort" flagged as the weak sub-concept because those specific questions were consistently wrong. The result screen shows this, with a direct CTA into the Visualizer scoped to "Merge Sort."

### 2.5 Concept Visualizer
A dedicated tab/route, deep-linkable by sub-concept id, opened automatically from the analysis screen (or manually from topic search, per the existing "Visualisor" search box in the prototype). For algorithmic/procedural concepts (sorting, scheduling, tree traversal, etc.) this should be a step-through animated visualization of the concept executing, with play/pause/step/reset controls. Where useful, contrast the student's apparent wrong mental model (inferred from their wrong answers) against the correct model side-by-side, as already prototyped in `ConceptVisualizerPage`. After viewing, surface a "retake test" CTA scoped to that sub-concept.

Not every concept is a clean animation — build a fallback path (annotated diagram / LLM-generated explanation with a static or lightly-animated SVG) for concepts that don't have a bespoke visualization yet.

### 2.6 Knowledge graph ("Galaxy Map")
A force-directed / DAG graph of topics and sub-concepts with prerequisite edges and a mastery level per node (new → basic → strong → expert, matching `GalaxyMapPage`). Mastery is computed from test history, not just the latest attempt. Locked nodes require prerequisites at "basic" or better to unlock.

### 2.7 Points (KP) system
- Award KP on test completion, scaled by score, question count, and difficulty. Long-answer and timed modes should carry a small multiplier over plain MCQ to reward harder modes.
- KP changes are an append-only ledger (`PointsLedgerEntry`: user, delta, reason, ref id, timestamp) — never mutate a running balance directly; derive balance from the ledger (or cache it and reconcile).
- Retaking a test and improving should award (smaller) incremental KP, not let students farm points by repeating an easy test — cap KP per topic per day or diminish repeat-attempt rewards.

### 2.8 Rewards Exchange
Two redeemable catalogs (matches `ExchangePage`):
- **Real-world rewards** — coupon/promo codes for partner-style brands, each with a KP cost. Sourced by the coupon scraper (2.9). Show source and "verified X ago" freshness, as prototyped.
- **Cosmetics** — app themes, avatar frames, cursor trails. Purely virtual, no scraper involved, just a KP-gated unlock table.

Redemption must check balance, debit the ledger, and — for real-world rewards — hand back a specific, currently-valid code (not a shared/generic one) if the reward type requires uniqueness; otherwise serve from a shared valid pool and mark low-stock/out-of-stock states.

### 2.9 Coupon scraper service (`services/coupon-scraper`)
Runs on a schedule (Celery beat / cron), independent of the request path — the API and web app only ever read from a pre-scraped, pre-validated table, never scrape live during a user request.

Responsibilities:
- Periodically search known coupon-aggregator sites and/or brand sites for promo codes relevant to the reward catalog's brands/categories.
- **Respect `robots.txt` and each site's terms of service.** Prefer official affiliate/coupon APIs where they exist over scraping; only scrape sites that permit it. This is a hard requirement, not a nice-to-have — do not build a scraper that ignores robots.txt or hammers a site without rate limiting.
- Deduplicate and validate codes (basic format checks; where possible, a lightweight redemption-page check that the code is still accepted) before they become redeemable.
- Store `CouponCode { code, brand, category, discount_detail, source, first_seen_at, last_verified_at, status }` in Postgres. `last_verified_at` drives the "2H AGO" style freshness label in the UI.
- Expire/hide codes that fail re-validation on a subsequent scrape pass.
- Rate-limit and back off per-domain; run with a clearly identifying user agent (`SCRAPER_USER_AGENT`).

### 2.10 Supporting features already designed in the prototype
These exist as UI in the uploaded Figma export and should be preserved/wired up, not treated as new scope to invent from nothing:
- **Timeline** — chronological feed of learning milestones (first attempt at a topic, concepts linked, constellations completed).
- **Achievements** — level/title progression (Stargazer → Explorer → Navigator → Astronomer → Cosmologist → Constellation Master) driven by XP/KP and milestones.
- **Friends / "Shared Skies"** — social layer: see friends' progress, light leaderboard. Treat as lower priority than the core test/analysis/visualize and points/rewards loops.

## 3. Architecture

Layered system, adapted from the reference architecture diagram:

- **Client** — `apps/web`: React + TypeScript + Vite + React Router (this is the actual stack of the delivered prototype — do not re-platform to Next.js unless there's a specific reason to; keep the existing routing/page structure: `/`, `/galaxy-map`, `/missions`, `/quiz`, `/quiz-mission`, `/visualizer`, `/timeline`, `/achievements`, `/friends`, `/exchange`). Tailwind + Radix primitives + Framer Motion (`motion`) for the constellation aesthetic, already established in `src/components/shared.tsx` (glass cards, starfield, mono labels).
- **API / Edge** — `apps/api`: FastAPI as the BFF/API gateway; JWT verification (Auth0 or self-issued); a LangGraph-orchestrated AI layer coordinating the AI engines below.
- **AI engines** (as LangGraph nodes / FastAPI services under `apps/api/app/services/`):
  - `quiz_generation` — LangChain + GPT-4o (or Claude) generating syllabus-grounded MCQ/long-answer/flashcard questions with topic + sub-concept tags, difficulty control.
  - `answer_analysis` — diagnoses wrong answers, extracts sub-concept weakness, emits the weak-node data consumed by the Galaxy Map and the Visualizer trigger.
  - `concept_visualization` — turns a sub-concept id into a visualization spec (step sequence / node-edge diagram / fallback explanation) consumed by the frontend visualizer.
  - `points_engine` — computes KP awards from a completed attempt, appends to the ledger.
  - `knowledge_graph` — maintains topic/sub-concept prerequisite graph and per-user mastery.
- **Processing** — syllabus ingestion (PDF/doc parsing) and embedding pipeline for retrieval-grounded question generation; async workers (Celery + Redis broker) for anything slow (generation, analysis, scraping).
- **Coupon scraper** — `services/coupon-scraper`, a separate deployable, scheduled independently of user requests (2.9).
- **Data stores**:
  - PostgreSQL — users, topics/sub-concepts, questions, test attempts, answer records, analysis results, points ledger, reward catalog, coupon codes, achievements.
  - Pinecone (or equivalent vector store) — syllabus/content embeddings for grounded question generation and topic search.
  - Neo4j (or a Postgres adjacency-table equivalent if you want to cut scope) — topic/sub-concept prerequisite graph for the Galaxy Map.
  - Redis — cache + Celery/async task queue + rate-limit state for the scraper.
  - S3 (or local disk in dev) — uploaded syllabus files, generated visualization assets.

## 4. Core data model (sketch)

`User(id, email, name, kp_balance_cached, level, created_at)`
`Topic(id, name, category)`
`SubConcept(id, topic_id, name, prereq_subconcept_ids[])`
`Question(id, subconcept_id, type[mcq|long_answer|flashcard], difficulty, prompt, choices?, reference_answer, source_ref)`
`TestAttempt(id, user_id, topic_id, mode[mcq|long_answer|flashcard|mixed], timed: bool, started_at, submitted_at, score)`
`AnswerRecord(id, attempt_id, question_id, subconcept_id, response, is_correct, partial_credit?, time_taken_s)`
`AnalysisResult(id, attempt_id, weak_subconcepts[{subconcept_id, rationale}], generated_at)`
`Mastery(user_id, subconcept_id, level[new|basic|strong|expert], updated_at)`
`PointsLedgerEntry(id, user_id, delta, reason, ref_type, ref_id, created_at)`
`RewardItem(id, kind[coupon|cosmetic], name, kp_cost, brand?, category?)`
`CouponCode(id, reward_item_id, code, source, first_seen_at, last_verified_at, status)`
`Achievement(id, user_id, key, unlocked_at)`

## 5. Build phases

1. **Foundation** — repo/app scaffolding, auth, topic model, Postgres schema/migrations, empty shell pages routed per the existing frontend structure.
2. **Core test loop (MVP)** — MCQ generation + taking + scoring, then long-answer and flashcard modes, then the timed modifier. Wire real API into `QuizPage`/`QuizMissionPage`.
3. **Analysis + Visualizer** — weak sub-concept detection, `AnalysisResult`, at least one fully-built visualizer (e.g. sorting algorithms, since it's the running example) plus the generic fallback path for other concepts, retake flow.
4. **Knowledge graph** — mastery computation, Galaxy Map wired to real mastery data.
5. **Points + Rewards** — ledger, KP award rules, cosmetics catalog (no scraper dependency, ship first), then the coupon scraper service and real-world reward redemption.
6. **Polish layer** — Timeline, Achievements, Friends/social.

## 6. Non-functional requirements

- **Scraper legality** — robots.txt compliance, per-domain rate limiting, prefer official coupon/affiliate APIs over scraping where available, no scraping during user-facing requests.
- **LLM cost control** — cache generated questions per topic/sub-concept/difficulty where reasonable rather than regenerating on every request; cache analysis explanations per (subconcept, wrong-answer-pattern) where feasible.
- **Testing** — unit tests for scoring and weak-point detection logic (these are the trust-critical parts of the product), integration tests for the test-submit → analysis → visualizer-trigger pipeline, and scraper validation tests using recorded fixtures rather than live network calls in CI.
- **Accessibility** — the constellation visuals are heavy on low-contrast text on dark backgrounds (per the prototype's color values); make sure real content meets at least AA contrast or provide a high-contrast mode.

## 7. Repo structure reference

See the top-level `README.md` for the full tree. Key mapping: `apps/web` = frontend (start from the Figma prototype), `apps/api` = FastAPI + LangGraph backend, `services/coupon-scraper` = standalone scraper, `packages/shared-types` = types shared between web and tooling, `infra` = docker-compose/deploy manifests, `docs` = this file plus architecture/API notes.
