# show_data.py
import sqlite3
conn = sqlite3.connect('fund_tagging.db')

# 1. fund_holding_exposure 有多少数据？按基金分组
print("=== fund_holding_exposure 数据量 ===")
rows = conn.execute("""
    SELECT f.fund_id, COUNT(*) as holdings_count
    FROM fund_holding_exposure f
    GROUP BY f.fund_id
    ORDER BY holdings_count DESC
    LIMIT 20
""").fetchall()
for r in rows: print(r)

# 2. 有没有 fund_list 表关联 fund_id → fund_name？
print("\n=== 有没有 fund_list 表？ ===")
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print([t[0] for t in tables])

# 3. 看几条 fund_holding_exposure 样本
print("\n=== fund_holding_exposure 样本 ===")
rows = conn.execute("SELECT * FROM fund_holding_exposure LIMIT 10").fetchall()
for r in rows: print(r)

# 4. 看 holding_tag_map 样本
print("\n=== holding_tag_map 样本 ===")
rows = conn.execute("SELECT * FROM holding_tag_map LIMIT 5").fetchall()
for r in rows: print(r)

conn.close()
