"""Run once after first startup: `python seed.py`. Creates a demo user
matching the KP_BALANCE=1380 currently hardcoded in ExchangePage.tsx, so
swapping the frontend to real data doesn't change what's on screen.

NOTE: this seeds the local placeholder points table (see database.py). Once
the real user/points table is confirmed, this script (and the placeholder
table itself) should be deleted.
"""
from database import SessionLocal, UserPointsPlaceholder, init_db

init_db()
db = SessionLocal()

if not db.query(UserPointsPlaceholder).filter(UserPointsPlaceholder.id == "1").first():
    db.add(UserPointsPlaceholder(id="1", name="Demo User", kp_balance=1380))
    db.commit()
    print("Seeded demo user (id=1, 1380 KP)")
else:
    print("Demo user already exists")

db.close()
