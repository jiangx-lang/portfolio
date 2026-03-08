# -*- coding: utf-8 -*-
import sqlite3
import sys
p = r"d:\house view\scb_reports.db"
if len(sys.argv) > 1:
    p = sys.argv[1]
c = sqlite3.connect(p)
r = c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
print("Tables:", [x[0] for x in r])
for t in [x[0] for x in r]:
    info = c.execute("PRAGMA table_info(%s)" % t).fetchall()
    print(t, ":", [(x[1], x[2]) for x in info])
# 验证 is_vectorized 仍在
rs = [row[1] for row in c.execute("PRAGMA table_info(report_segments)").fetchall()]
assert "is_vectorized" in rs and "tags" in rs, "report_segments 应含 is_vectorized 与 tags"
print("OK report_segments.is_vectorized & tags")
c.close()
