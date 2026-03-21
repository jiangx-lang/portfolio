import sqlite3, pandas as pd
conn = sqlite3.connect(r'E:\FinancialData\nav_history.db')

df = pd.read_sql("SELECT * FROM fund_list WHERE code LIKE '%QDUR134%'", conn)
print('fund_list QDUR134:')
print(df.to_string())

df2 = pd.read_sql("SELECT DISTINCT isin FROM nav_history LIMIT 20", conn)
print('nav_history ISINs:')
print(df2.to_string())
conn.close()
