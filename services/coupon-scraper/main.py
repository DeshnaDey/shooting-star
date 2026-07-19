import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

from database import init_db
from scraper.runner import run_scrape
from routes import coupons, transactions

load_dotenv()

SCRAPE_INTERVAL_MINUTES = 30
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    run_scrape()  # populate on startup so the API isn't empty on first boot

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_scrape, "interval", minutes=SCRAPE_INTERVAL_MINUTES)
    scheduler.start()

    yield
    scheduler.shutdown()


app = FastAPI(title="Constellation Exchange API", lifespan=lifespan)

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
