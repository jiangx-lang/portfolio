import sqlite3, pandas as pd
conn = sqlite3.connect(r'E:\FinancialData\nav_history.db')
df = pd.read_sql("SELECT * FROM nav_history WHERE isin IN ('LU0056508442','LU2250418907') LIMIT 5", conn)
print(df.to_string())
conn.close()
