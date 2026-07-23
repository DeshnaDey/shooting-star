"""One-off: give existing users a real starting KP balance instead of 0.

Not runtime logic - unlike an earlier version of this service, redemption
requests no longer try to compute/set a starting balance themselves (that
caused a NOT NULL violation trying to insert incomplete user rows - see
routes/transactions.py's _get_user docstring). This script does that setup
work once, safely, by computing each user's historical points directly
from backend's test_attempts table (same database, so no HTTP call needed)
and writing it to their kp_balance_cached.

Only touches users still at exactly 0 (the migration's default) - won't
overwrite anyone who's already started spending. Safe to re-run.

Usage: python scripts/backfill_initial_points.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine


def main() -> None:
    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT u.id, COALESCE(SUM(t.score), 0) AS total_score
            FROM users u
            LEFT JOIN test_attempts t ON t.user_id = u.id AND t.status = 'submitted'
            WHERE u.kp_balance_cached = 0
            GROUP BY u.id
        """)).fetchall()

        updated = 0
        for user_id, total_score in rows:
            if total_score and total_score > 0:
                conn.execute(
                    text("UPDATE users SET kp_balance_cached = :kp WHERE id = :id"),
                    {"kp": int(total_score), "id": user_id},
                )
                updated += 1
                print(f"user {user_id}: kp_balance_cached -> {int(total_score)}")

    print(f"Done: {updated} user(s) backfilled.")


if __name__ == "__main__":
    main()
