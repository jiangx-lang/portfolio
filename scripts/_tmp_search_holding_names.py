import sqlite3

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
conn.row_factory = sqlite3.Row

queries = [
    "ELI LILLY",
    "LILLY",
    "ASTRAZENECA",
    "AB VIE",
    "ABBVIE",
    "UNITEDHEALTH",
    "UNITED",
]

def norm(s: str) -> str:
    return "".join(s.split()).upper()

for q in queries:
    rows = conn.execute(
        """
        SELECT holding_name_std, COUNT(*) AS cnt
        FROM holding_tag_map
        WHERE holding_name_std LIKE ?
        GROUP BY holding_name_std
        ORDER BY cnt DESC, holding_name_std
        LIMIT 8
        """,
        ("%"+q+"%",),
    ).fetchall()
    print("\n", q)
    for r in rows:
        print(dict(r))

conn.close()

