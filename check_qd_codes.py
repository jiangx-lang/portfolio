# check_qd_codes.py
import pandas as pd
df = pd.read_csv("top_holdings_detail.csv")
funds = df[["fund_id", "fund_name_cn", "sc_product_codes"]].drop_duplicates()
print(f"QD 基金总数: {len(funds)}")
print(funds.to_string())
