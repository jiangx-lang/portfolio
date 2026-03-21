import sqlite3
conn = sqlite3.connect("fund_tagging.db")
for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
    print("TABLE:", t[0])
    for col in conn.execute(f"PRAGMA table_info({t[0]})").fetchall():
        print(" ", col)
