# verify_qd.py
import sqlite3
conn = sqlite3.connect('qdii_portfolio/fund_tagging.db')

print("=== 有 primary_code 的基金 ===")
rows = conn.execute("""
  SELECT fund_name_cn, primary_code, sc_product_code,
         COUNT(*) as cnt, MAX(as_of_date) as latest
  FROM fund_holding_exposure
  WHERE primary_code IS NOT NULL
  GROUP BY fund_id
  ORDER BY fund_name_cn
  LIMIT 20
""").fetchall()
for r in rows:
    print(r)

print("\n=== 总计 ===")
total = conn.execute("SELECT COUNT(DISTINCT fund_id) FROM fund_holding_exposure WHERE primary_code IS NOT NULL").fetchone()
print(f"有持仓数据的基金: {total[0]} 只")
conn.close()
