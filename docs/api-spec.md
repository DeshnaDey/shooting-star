# API Spec

Placeholder — document real endpoints here as they're built (auth, topics, quizzes, analysis, visualizer, points, rewards). Suggested initial groups, per `PROMPT.md`:

- `POST /auth/*`
- `GET /topics`, `GET /topics/{id}`
- `POST /quizzes` (create attempt), `POST /quizzes/{attempt_id}/submit`
- `GET /analysis/{attempt_id}`
- `GET /visualizer/{subconcept_id}`
- `GET /points/ledger`, `GET /points/balance`
- `GET /rewards`, `POST /rewards/{id}/redeem`
