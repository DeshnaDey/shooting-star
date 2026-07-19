"""Run once for local testing: `python seed.py`. Creates a demo user matching
the KP_BALANCE=1380 currently hardcoded in ExchangePage.tsx.

NOTE: in the real system, users are created by apps/api (auth), not here.
This is purely a local dev convenience so this service is testable in
isolation before apps/api exists / before the two are wired together.
"""
from database import SessionLocal, User, init_db

init_db()
db = SessionLocal()

if not db.query(User).filter(User.id == "1").first():
    db.add(User(id="1", name="Demo User", kp_balance_cached=1380))
    db.commit()
    print("Seeded demo user (id=1, 1380 KP)")
else:
    print("Demo user already exists")

db.close()
