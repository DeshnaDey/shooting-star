"""
One-time cleanup: removes leftover test/fixture reward items (Starbucks,
Amazon, Netflix, Sony, Dominos) that were seeded during early development
testing and are still sitting in the shared database.

Run once: python -m scraper.cleanup_test_data
Safe to run multiple times - does nothing if the test brands are already gone.
"""
from database import SessionLocal, RewardItem, CouponCode

TEST_BRANDS = ["Starbucks", "Amazon", "Netflix", "Sony", "Dominos"]

db = SessionLocal()
removed = 0

for item in db.query(RewardItem).filter(RewardItem.brand.in_(TEST_BRANDS)).all():
    db.query(CouponCode).filter(CouponCode.reward_item_id == item.id).delete()
    db.delete(item)
    removed += 1

db.commit()
db.close()
print(f"Removed {removed} leftover test reward item(s) and their codes.")
