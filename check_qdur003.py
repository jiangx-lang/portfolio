# 临时脚本：核对 cn-fs-qdur003 解析入库情况
import sqlite3
conn = sqlite3.connect("sc_funds.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def by_fund(s):
    return cur.execute(s, (1,)).fetchall()

print("=== funds (基金主表) ===")
for r in cur.execute("SELECT * FROM funds WHERE id=1").fetchall():
    for k in r.keys():
        v = r[k]
        if v is not None and str(v).strip():
            print(f"  {k}: {v}")

print("\n=== fund_managers (基金经理) ===")
for r in cur.execute("SELECT name, title, bio FROM fund_managers WHERE fund_id=1").fetchall():
    print(dict(r))

print("\n=== fund_performance (业绩) ===")
for r in cur.execute("SELECT share_class, currency, as_of_date, ret_3m, ret_6m, ret_ytd, ret_1y, ret_3y, ret_5y, ret_since_inception, benchmark_name, nav FROM fund_performance WHERE fund_id=1").fetchall():
    print(dict(r))

print("\n=== dividend_history (派息) ===")
rows = cur.execute("SELECT * FROM dividend_history WHERE fund_id=1").fetchall()
print(f"  共 {len(rows)} 条" + (f": {[dict(r) for r in rows]}" if rows else ""))

print("\n=== top_holdings (十大持仓) ===")
for r in cur.execute("SELECT rank, holding_name, holding_type, weight_pct FROM top_holdings WHERE fund_id=1 ORDER BY rank").fetchall():
    print(dict(r))

print("\n=== regional_allocation (区域配置) ===")
for r in cur.execute("SELECT region, weight_pct FROM regional_allocation WHERE fund_id=1 ORDER BY weight_pct DESC").fetchall():
    print(dict(r))

print("\n=== sector_allocation (行业配置) ===")
for r in cur.execute("SELECT sector, weight_pct FROM sector_allocation WHERE fund_id=1 ORDER BY weight_pct DESC").fetchall():
    print(dict(r))

print("\n=== asset_class_allocation (资产类别) ===")
for r in cur.execute("SELECT asset_class, weight_pct FROM asset_class_allocation WHERE fund_id=1 ORDER BY weight_pct DESC").fetchall():
    print(dict(r))

print("\n=== credit_rating_allocation (信用评级) ===")
for r in cur.execute("SELECT rating, weight_pct FROM credit_rating_allocation WHERE fund_id=1 ORDER BY weight_pct DESC").fetchall():
    print(dict(r))

print("\n=== parse_log ===")
for r in cur.execute("SELECT source_file, status, fields_found FROM parse_log WHERE source_file LIKE '%qdur003%'").fetchall():
    print(dict(r))

conn.close()
print("\n[OK] 核对完成")
