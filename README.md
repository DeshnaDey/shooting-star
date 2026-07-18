# Shooting Star

Space-themed adaptive learning platform: pick a star (topic) from a 3D constellation → enter its solar system (subtopics as planets) → take a test (MCQ / long-answer / flashcards, optionally timed) → get analysed down to the specific subtopic you're weak on → step through an AI-generated concept visualisation → retake and improve.

Full long-term spec (points, coupon scraper, social, etc.): [`docs/PROMPT.md`](docs/PROMPT.md).

## Structure

```
shooting-star/
├── apps/
│   ├── web/          # React + TS + Vite + react-three-fiber frontend
│   │   └── src/
│   │       ├── pages/       # ConstellationPage, SolarSystemPage, TestPage, VisualiserPage
│   │       ├── components/  # HUD buttons/panels, three.js helpers
│   │       ├── lib/api.ts   # API client
│   │       ├── data/        # 3D layout data + offline mock analysis
│   │       └── styles/      # pink-purple-white theme
│   └── api/          # FastAPI backend
│       └── app/
│           ├── api/routes.py       # topics, attempts, submit, analysis
│           ├── core/config.py      # env settings
│           ├── db/                 # engine + seed
│           ├── models/ schemas/
│           └── services/           # llm adapter, quiz_generation, grading, answer_analysis
├── services/coupon-scraper/   # future: rewards scraper (see PROMPT.md)
├── packages/ infra/ scripts/  # future phases
└── docs/PROMPT.md             # full product spec
```

## Running it

**Backend** (Python 3.10+):

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000
```

**Frontend**:

```bash
cd apps/web
npm install
npm run dev                            # http://localhost:5173
```

Works out of the box with zero config: SQLite database + deterministic mock question bank.

## Turning on the real AI

The backend calls any OpenAI-compatible endpoint. Two free options via [Ollama](https://ollama.com):

- **Local**: install Ollama, `ollama pull qwen3:8b`, done — the default config points at `http://localhost:11434`.
- **Ollama Cloud (free tier)**: sign up at ollama.com, create an API key, then in `apps/api/.env` set `OLLAMA_BASE_URL=https://ollama.com`, `OLLAMA_API_KEY=...`, `OLLAMA_MODEL=gpt-oss:20b`.

If the LLM is unreachable the app automatically falls back to the mock provider (responses are labelled with the engine used). Weak-subtopic detection is deterministic (accuracy per subtopic, min 2 questions) — the LLM writes the diagnosis and visualiser frames, never the verdict.

## Supabase

Default DB is a local SQLite file. To use Supabase: dashboard → Connect → copy the *Session pooler* URI into `apps/api/.env` as `DATABASE_URL`, changing the scheme to `postgresql+psycopg://`. Tables are created and seeded automatically on first startup.

See `.env.example` for all settings.

## Tests

```bash
cd apps/api && python3 -m pytest        # full core-loop tests (mock LLM, throwaway DB)
cd apps/web && npm run build            # typecheck + production build
```
