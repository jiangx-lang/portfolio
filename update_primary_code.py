# 把 QDUR128USD,QDUR128EUR 拆分，取第一个作为 primary_code（去货币后缀）
import sqlite3
import pandas as pd

conn = sqlite3.connect("qdii_portfolio/fund_tagging.db")
try:
    conn.execute("ALTER TABLE fund_holding_exposure ADD COLUMN primary_code TEXT")
    conn.commit()
except Exception:
    pass

CURRENCY_SUFFIXES = ("USD", "EUR", "CNY", "HKD", "SGD", "AUD", "GBP")

df = pd.read_csv("top_holdings_detail.csv")
for _, row in df.iterrows():
    codes = str(row.get("sc_product_codes", "") or "").strip()
    if not codes or codes == "nan":
        continue
    first = codes.split(",")[0].strip()
    primary = first[:-3] if len(first) > 3 and first[-3:] in CURRENCY_SUFFIXES else first
    holding_name = row.get("holding_name") or row.get("holding_name_std") or ""
    if not holding_name:
        continue
    conn.execute(
        """
        UPDATE fund_holding_exposure
        SET primary_code = ?, sc_product_code = ?
        WHERE fund_id = ? AND holding_name_std = ? AND as_of_date = ?
    """,
        (primary, first, row["fund_id"], holding_name, row.get("as_of_date", "")),
    )
conn.commit()
conn.close()
print("primary_code 写入完成")
