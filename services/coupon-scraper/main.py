"""
API for the coupon-scraper service. Per docs/PROMPT.md 2.9, this process
ONLY reads pre-scraped, pre-validated data - it never scrapes on the request
path and does not run the scraper on a timer.

The scraper (scraper/runner.py) must be run separately, on a schedule:
  - Locally: `python -m scraper.runner`
  - Cron:    */30 * * * * cd /path/to/services/coupon-scraper && python -m scraper.runner
  - Celery beat: wrap run_scrape() in a task, schedule via beat_schedule
See scraper/runner.py's module docstring for details.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import init_db
from routes import coupons, transactions

load_dotenv()

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # creates tables if they don't exist yet; no-op otherwise
    yield


app = FastAPI(title="Constellation Coupon Scraper API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coupons.router)
app.include_router(transactions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
