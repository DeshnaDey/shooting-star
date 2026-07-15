# Constellation Learning

Space/constellation-themed adaptive learning platform: search a topic → take a test (MCQ / long-answer / flashcard / timed) → get analyzed down to the specific sub-concept you're weak on → visualize that sub-concept → retake and improve. Score-based Knowledge Points (KP) redeem for coupon rewards (found by a background web scraper) and cosmetic unlocks.

This repo is currently an **empty scaffold**. Full spec: [`docs/PROMPT.md`](docs/PROMPT.md).

## Structure

```
constellation-learning/
├── apps/
│   ├── web/                    # React + TS + Vite + React Router frontend
│   │   └── src/
│   │       ├── app/            # router, root layout
│   │       ├── pages/          # route-level pages (galaxy, quiz, visualizer, exchange, ...)
│   │       ├── features/       # quiz, analysis, visualizer, knowledge-graph, points-exchange, achievements, social, auth
│   │       ├── components/     # shared + ui primitives
│   │       ├── lib/ hooks/ styles/ types/
│   │       └── public/
│   └── api/                    # FastAPI backend
│       └── app/
│           ├── api/v1/routers/
│           ├── core/           # config, security, deps
│           ├── models/ schemas/
│           ├── db/migrations/
│           ├── services/       # quiz_generation, answer_analysis, concept_visualization, points_engine, knowledge_graph
│           └── workers/        # Celery tasks
├── services/
│   └── coupon-scraper/         # standalone scheduled scraper for the rewards exchange
├── packages/
│   └── shared-types/           # types shared between web + tooling
├── infra/                      # docker-compose, k8s manifests
├── docs/
│   ├── PROMPT.md                # full build spec — start here
│   ├── architecture.md
│   └── api-spec.md
└── scripts/
```

## Getting started

Not implemented yet — this is scaffolding only. Build order and feature spec are in [`docs/PROMPT.md`](docs/PROMPT.md).
