# import_holdings.py
import sqlite3
import pandas as pd
from pathlib import Path

CSV_PATH = "top_holdings_detail.csv"
DB_PATH = "qdii_portfolio/fund_tagging.db"

df = pd.read_csv(CSV_PATH)
print("CSV 列名:", df.columns.tolist())
print("总行数:", len(df))
print("基金列表:")
print(df[["fund_id", "fund_name_cn"]].drop_duplicates().to_string())
print("\n样本:")
print(df.head(5).to_string())

conn = sqlite3.connect(DB_PATH)

# 确保 fund_holding_exposure 有 fund_name_cn 列（方便直接查）
try:
    conn.execute("ALTER TABLE fund_holding_exposure ADD COLUMN fund_name_cn TEXT")
    conn.commit()
    print("\n已添加 fund_name_cn 列")
except Exception:
    print("\nfund_name_cn 列已存在")

# 导入数据
inserted = 0
for _, row in df.iterrows():
    try:
        holding_name = row.get("holding_name") or row.get("holding_name_std") or ""
        if not holding_name:
            continue
        conn.execute(
            """
            INSERT OR IGNORE INTO fund_holding_exposure
            (fund_id, fund_name_cn, holding_name_std, holding_name_raw,
             holding_type, weight_pct, rank, as_of_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                row.get("fund_id"),
                row.get("fund_name_cn"),
                holding_name,
                holding_name,
                row.get("holding_type", "equity"),
                row.get("weight_pct", 0),
                row.get("rank", 0),
                row.get("as_of_date", ""),
            ),
        )
        inserted += 1
    except Exception as e:
        print(f"跳过: {e}")

conn.commit()
conn.close()
print(f"\n导入完成：{inserted} 条持仓数据写入 fund_holding_exposure")
