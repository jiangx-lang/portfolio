# 核对 cn-fs-qdut001 解析结果
import sqlite3
conn = sqlite3.connect("sc_funds.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
fid = cur.execute("SELECT id FROM funds WHERE source_file LIKE '%qdut001%'").fetchone()[0]

print("=== funds (基金主表) ===")
for r in cur.execute("SELECT * FROM funds WHERE id=?", (fid,)).fetchall():
    for k in r.keys():
        v = r[k]
        if v is not None and str(v).strip():
            print(f"  {k}: {v}")

print("\n=== fund_managers ===")
for r in cur.execute("SELECT name, title FROM fund_managers WHERE fund_id=?", (fid,)).fetchall():
    print(dict(r))

print("\n=== fund_performance ===")
for r in cur.execute("SELECT share_class, currency, as_of_date, ret_3m, ret_1y, ret_3y, ret_5y, ret_since_inception, nav FROM fund_performance WHERE fund_id=?", (fid,)).fetchall():
    print(dict(r))

print("\n=== top_holdings (前10) ===")
for r in cur.execute("SELECT rank, holding_name, holding_type, weight_pct FROM top_holdings WHERE fund_id=? ORDER BY rank LIMIT 10", (fid,)).fetchall():
    print(dict(r))

print("\n=== regional_allocation (前5) ===")
for r in cur.execute("SELECT region, weight_pct FROM regional_allocation WHERE fund_id=? ORDER BY weight_pct DESC LIMIT 5", (fid,)).fetchall():
    print(dict(r))

print("\n=== sector_allocation (前5) ===")
for r in cur.execute("SELECT sector, weight_pct FROM sector_allocation WHERE fund_id=? ORDER BY weight_pct DESC LIMIT 5", (fid,)).fetchall():
    print(dict(r))

print("\n=== asset_class_allocation ===")
for r in cur.execute("SELECT asset_class, weight_pct FROM asset_class_allocation WHERE fund_id=?", (fid,)).fetchall():
    print(dict(r))

print("\n=== pending_new_fields ===")
for r in cur.execute("SELECT term_found, sample_value FROM pending_new_fields WHERE source_file LIKE '%qdut001%' AND confirmed=0").fetchall():
    print(dict(r))

conn.close()
print("\n[OK]")
