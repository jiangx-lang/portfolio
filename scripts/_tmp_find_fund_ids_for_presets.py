import sqlite3

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
conn.row_factory = sqlite3.Row

names = [
    "联博—国际健康护理基金",
    "施罗德医疗创新股票基金",
    "贝莱德世界健康科学基金",
    "贝莱德世界科技基金",
    "富兰克林科技基金",
    "安联环球人工智能股票基金",
    "贝莱德世界能源基金",
    "施罗德商品基金",
    "贝莱德世界黄金基金",
    "联博—新兴市场股债基金",
    "景顺亚洲资产配置基金",
    "宏利亚太房地产 REITs 基金",
    "富兰克林西方资产亚洲机会基金",
    "富洁美元债券基金",
    "东方汇理 CIO 精选保守基金",
]

def norm(s: str) -> str:
    return "".join(s.split())

def query(pattern: str):
    sql = """
    SELECT fund_id, fund_name_cn, primary_code, sc_product_code
    FROM fund_holding_exposure
    WHERE fund_name_cn LIKE ?
    GROUP BY fund_id
    """
    return conn.execute(sql, (pattern,)).fetchall()

for nm in names:
    rows = query("%" + nm + "%")
    if not rows:
        rows = query("%" + norm(nm) + "%")
    print("\n", nm)
    if not rows:
        print("NOT FOUND")
    else:
        for r in rows:
            print(dict(r))

conn.close()

