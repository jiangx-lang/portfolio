import sqlite3

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
conn.row_factory = sqlite3.Row

queries = [
    "FLOATING RATE BD",
    "TREASURY",
    "BOND 1-3",
    "GOVT",
]

for q in queries:
    rows = conn.execute(
        """
        SELECT holding_name_std, COUNT(*) AS cnt
        FROM holding_tag_map
        WHERE holding_name_std LIKE ?
        GROUP BY holding_name_std
        ORDER BY cnt DESC, holding_name_std
        LIMIT 10
        """,
        ("%" + q + "%",),
    ).fetchall()
    print("\n", q)
    for r in rows:
        print(dict(r))

conn.close()

