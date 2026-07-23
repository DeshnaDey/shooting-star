#!/usr/bin/env bash
# Start both backend services together:
#   - main backend      → http://localhost:8000  (constellation, topics, tests, profile)
#   - coupon-scraper     → http://localhost:8001  (Trade Center rewards)
#
# Ctrl+C stops both. Run the frontend separately: cd frontend && npm run dev
#
# Usage:  ./dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick a uvicorn for each service: prefer a service-local .venv, else the
# uvicorn already on your PATH (e.g. your conda base). We call the uvicorn
# executable directly rather than `python3 -m uvicorn`, because a bare
# `python3` may resolve to a different interpreter (e.g. Homebrew) that
# doesn't have uvicorn installed.
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
( cd "$ROOT/backend" && exec "$BACKEND_UV" app.main:app --reload --port 8000 ) &
pids+=($!)

echo "› coupon-scraper  → http://localhost:8001"
( cd "$ROOT/services/coupon-scraper" && exec "$COUPON_UV" main:app --reload --port 8001 ) &
pids+=($!)

echo "› both running. Press Ctrl+C to stop both."
wait
