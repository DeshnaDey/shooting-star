#!/usr/bin/env bash
# Start the whole app with one command:
#   - main backend      → http://localhost:8000  (constellation, topics, tests, profile)
#   - coupon-scraper     → http://localhost:8001  (Trade Center rewards)
#   - frontend (Vite)    → http://localhost:5173  (open this in your browser)
#
# Ctrl+C stops all three.
#
# Usage:  ./dev.sh          (hot-reload OFF — safe on iCloud-synced folders)
#         RELOAD=1 ./dev.sh (hot-reload ON — only if repo is NOT on iCloud/Dropbox)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Hot-reload is OFF by default. This project lives under ~/Desktop, which macOS
# syncs to iCloud Drive; iCloud constantly rewrites file timestamps, and
# uvicorn's --reload watcher reads every bump as a code change and restarts in
# an endless loop. To restart after a code change, just Ctrl+C and re-run.
RELOAD_FLAG=""
if [ "${RELOAD:-0}" = "1" ]; then
  RELOAD_FLAG="--reload"
fi

# Pick a uvicorn for each service: prefer a service-local .venv, else the
# uvicorn already on your PATH (e.g. your conda base). We call the uvicorn
# executable directly rather than `python3 -m uvicorn`, because a bare
# `python3` may resolve to a different interpreter (e.g. Homebrew) without it.
uvfor() {  # $1 = service dir
  if [ -x "$1/.venv/bin/uvicorn" ]; then
    echo "$1/.venv/bin/uvicorn"
  elif command -v uvicorn >/dev/null 2>&1; then
    echo "uvicorn"
  else
    echo "MISSING"
  fi
}

BACKEND_UV="$(uvfor "$ROOT/backend")"
COUPON_UV="$(uvfor "$ROOT/services/coupon-scraper")"

if [ "$BACKEND_UV" = "MISSING" ] || [ "$COUPON_UV" = "MISSING" ]; then
  echo "✗ uvicorn not found on PATH. Activate the env that has it (e.g. conda base)"
  echo "  or install it:  pip install uvicorn"
  exit 1
fi

# Free our ports first so stale servers from a previous run can't collide.
for port in 8000 8001 5173; do
  pids_on_port="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$pids_on_port" ]; then
    echo "› freeing port $port (killing stale: $pids_on_port)"
    echo "$pids_on_port" | xargs kill -9 2>/dev/null || true
  fi
done

pids=()
cleanup() {
  echo ""
  echo "› stopping services…"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "› main backend    → http://localhost:8000"
( cd "$ROOT/backend" && exec "$BACKEND_UV" app.main:app $RELOAD_FLAG --port 8000 ) &
pids+=($!)

echo "› coupon-scraper  → http://localhost:8001"
( cd "$ROOT/services/coupon-scraper" && exec "$COUPON_UV" main:app $RELOAD_FLAG --port 8001 ) &
pids+=($!)

echo "› frontend        → http://localhost:5173"
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "  (installing frontend deps first — one-time)"
  ( cd "$ROOT/frontend" && npm install )
fi
( cd "$ROOT/frontend" && exec npm run dev -- --port 5173 --strictPort ) &
pids+=($!)

echo "› all running. Open http://localhost:5173 — press Ctrl+C to stop everything."
wait
