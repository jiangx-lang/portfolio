# add_code_column.py
import sqlite3
import pandas as pd

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
try:
    conn.execute("ALTER TABLE fund_holding_exposure ADD COLUMN sc_product_code TEXT")
    conn.commit()
    print("列已添加")
except Exception:
    print("列已存在")

df = pd.read_csv("top_holdings_detail.csv")
for _, row in df.iterrows():
    codes = str(row.get("sc_product_codes", "") or "").strip()
    if not codes or codes == "nan":
        continue
    holding_name = row.get("holding_name") or row.get("holding_name_std") or ""
    if not holding_name:
        continue
    conn.execute(
        """
        UPDATE fund_holding_exposure
        SET sc_product_code = ?
        WHERE fund_id = ? AND holding_name_std = ? AND as_of_date = ?
    """,
        (codes, row["fund_id"], holding_name, row.get("as_of_date", "")),
    )
conn.commit()
conn.close()
print("sc_product_code 写入完成")
