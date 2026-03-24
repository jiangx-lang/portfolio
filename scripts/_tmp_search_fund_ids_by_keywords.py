import sqlite3

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
conn.row_factory = sqlite3.Row

keywords = [
    "医疗创新",
    "健康科学",
    "世界科技",
    "人工智能",
    "世界能源",
    "黄金",
    "新兴市场股债",
    "亚洲资产配置",
    "亚太房地产",
    "亚洲机会",
    "美元债",
    "CIO 精选保守",
]

def norm(s: str) -> str:
    return "".join(s.split())

def search(k: str):
    # try raw
    rows = conn.execute(
        """
        SELECT fund_id, fund_name_cn, primary_code
        FROM fund_holding_exposure
        WHERE fund_name_cn LIKE ?
        GROUP BY fund_id
        ORDER BY fund_name_cn
        LIMIT 10
        """,
        ("%" + k + "%",),
    ).fetchall()
    if rows:
        return rows
    # try normalized
    rows = conn.execute(
        """
        SELECT fund_id, fund_name_cn, primary_code
        FROM fund_holding_exposure
        WHERE REPLACE(fund_name_cn,' ','') LIKE ?
        GROUP BY fund_id
        ORDER BY fund_name_cn
        LIMIT 10
        """,
        ("%" + norm(k) + "%",),
    ).fetchall()
    return rows

for k in keywords:
    rows = search(k)
    print("\n", k)
    if not rows:
        print("NOT FOUND")
    else:
        for r in rows:
            print(dict(r))

conn.close()

