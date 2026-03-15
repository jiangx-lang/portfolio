import sqlite3
conn = sqlite3.connect("./sc_funds.db")
ids = (5,6,7,8,9,11,13,14,17,19,20,21,22,23,24,25,27,28,29,30,37,40,41,44,48,51,52,54,55,56,59,61,64,65,66,67,70,72,75,76,77,78,79,80,81,82,84,85,87,89,92,93,94,97,99,100,101,102,103,104,105,107,108,115,117,118,119,120,121,123,124,125,127,130,131,133,134,137,138,140,142,143,144,145,146,147)
placeholders = ",".join("?" * len(ids))
conn.execute(
    "UPDATE funds SET status = 2, review_reason = '从parsing_logs还原' WHERE id IN (" + placeholders + ")",
    ids,
)
n = conn.total_changes
conn.commit()
after = conn.execute("SELECT status, COUNT(*) FROM funds GROUP BY status").fetchall()
conn.close()
print("已更新", n, "条 -> status=2, review_reason=从parsing_logs还原")
print("当前分布:", dict(after))
