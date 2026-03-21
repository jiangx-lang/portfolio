# show_codes.py
import pandas as pd
df = pd.read_csv("top_holdings_detail.csv")
print("sc_product_codes 样本：")
print(df[["fund_id", "fund_name_cn", "sc_product_codes"]].drop_duplicates().head(30).to_string())
print("\n所有唯一 codes：")
print(df["sc_product_codes"].dropna().unique())
