import sqlite3
conn = sqlite3.connect("sc_funds.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
row = cur.execute("SELECT id FROM funds WHERE source_file = ?", ("cn-fs-qdur048.pdf",)).fetchone()
if not row:
    print("未找到 cn-fs-qdur048.pdf")
    exit()
fid = row[0]
print("=== 基金主表 ===")
r = cur.execute("SELECT fund_name_cn, inception_date, fund_aum_usd, aum_date, sc_risk_rating, mgmt_fee_pct, custody_fee_pct, admin_fee_pct FROM funds WHERE id = ?", (fid,)).fetchone()
print(dict(r))
print("\n=== 业绩 ===")
for row in cur.execute("SELECT share_class, as_of_date, ret_3m, ret_6m, ret_ytd, ret_1y, ret_3y, ret_5y, ret_since_inception, nav FROM fund_performance WHERE fund_id = ?", (fid,)).fetchall():
    print(dict(row))
print("\n=== 十大持仓(前5) ===")
for row in cur.execute("SELECT rank, holding_name, holding_type, weight_pct FROM top_holdings WHERE fund_id = ? ORDER BY rank LIMIT 5", (fid,)).fetchall():
    print(dict(row))
print("\n派息记录:", cur.execute("SELECT COUNT(*) FROM dividend_history WHERE fund_id = ?", (fid,)).fetchone()[0], "条")
conn.close()
print("\n[OK]")
