# -*- coding: utf-8 -*-
"""Scan result report: DB stats, needs_review, pending fields. No emoji for gbk console."""
import sqlite3
import os
os.environ["PYTHONIOENCODING"] = "utf-8"

DB = "sc_funds.db"
conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=" * 60)
print("  SCAN RESULT /  scanning result")
print("=" * 60)

# 1) Funds by status (0=pending 1=OK 2=needs_review)
total = cur.execute("SELECT COUNT(*) FROM funds").fetchone()[0]
ok = cur.execute("SELECT COUNT(*) FROM funds WHERE status=1").fetchone()[0]
review = cur.execute("SELECT COUNT(*) FROM funds WHERE status=2").fetchone()[0]
pending = cur.execute("SELECT COUNT(*) FROM funds WHERE status=0").fetchone()[0]
print("\n  Funds: total=%d  |  OK(1)=%d  |  needs_review(2)=%d  |  pending(0)=%d" % (total, ok, review, pending))

# 2) Needs review list (status=2)
rows = cur.execute("""
    SELECT id, source_file, fund_name_cn, sc_product_codes, review_reason
    FROM funds WHERE status=2 ORDER BY parsed_at DESC
""").fetchall()
if rows:
    print("\n  --- Needs your confirm (status=2) ---")
    for r in rows:
        print("    [%s] %s | %s" % (r[1], (r[2] or "?").strip()[:40], (r[4] or "")[:50]))
    print("    Run: py -3 sc_fund_parser_qwen_v2.py --audit")
else:
    print("\n  No needs_review records (status=2).")

# 3) Pending new fields (confirm/ignore)
pend = cur.execute("SELECT COUNT(*) FROM pending_new_fields WHERE confirmed=0").fetchone()[0]
print("\n  Pending new fields (confirm=0): %d" % pend)
rows = cur.execute("""
    SELECT id, source_file, term_found, sample_value
    FROM pending_new_fields WHERE confirmed=0 ORDER BY id
""").fetchall()
for r in rows:
    sample = (r[3] or "")[:60].replace("\n", " ")
    print("    [%d] %s  |  term: %s  |  sample: %s" % (r[0], r[1], r[2], sample))
if pend:
    print("    Run: --confirm <id> to confirm  |  --ignore <id> to ignore")

# 4) Token usage: not stored in DB, only printed at end of run
print("\n  Token usage: not stored in DB; shown at end of each run.")
print("  If last run failed before finish, no token total was printed.")
print("=" * 60)
conn.close()
