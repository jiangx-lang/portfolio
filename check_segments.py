# -*- coding: utf-8 -*-
"""查看 report_segments：条数、是否含中/英文关键词"""
import sqlite3
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB = Path(r"d:\house view\scb_reports.db")
conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM report_segments")
n = cur.fetchone()[0]
print("report_segments 总行数:", n)

cur.execute("SELECT id, content FROM report_segments")
rows = cur.fetchall()

# 中文关键词（原打标）
for kw in ["日本", "日元", "美国", "美联储", "美元", "黄金", "避险"]:
    c = sum(1 for (_, x) in rows if x and kw in (x or ""))
    print("CN [%s]: %d" % (kw, c))

# 英文关键词（若加入打标可提高命中）
for kw in ["Japan", "Japanese", "yen", "US", "USA", "Fed", "dollar", "gold", "Gold", "safe haven", "Standard Chartered"]:
    c = sum(1 for (_, x) in rows if x and kw in (x or ""))
    if c > 0:
        print("EN [%s]: %d" % (kw, c))
conn.close()
