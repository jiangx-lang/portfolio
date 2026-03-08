# -*- coding: utf-8 -*-
"""
基于 scb_reports.db 的数据增强：自动打标签 + 模拟持仓录入 + 控制台验证
"""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(r"d:\house view\scb_reports.db")

# 关键词 -> tag（中英文均支持，当前库为英文内容故英文命中多）
KEYWORD_TAGS = [
    (["日本", "日元", "Japan", "Japanese", "yen"], "Japan"),
    (["美国", "美联储", "美元", "US", "USA", "Fed", "dollar"], "US"),
    (["黄金", "避险", "gold", "Gold", "safe haven"], "Gold"),
]


def _extract_tags(content: str | None) -> str:
    """根据关键词匹配生成逗号分隔的 tags。"""
    if not content or not isinstance(content, str):
        return ""
    text = content.strip()
    if not text:
        return ""
    tags = []
    for keywords, tag in KEYWORD_TAGS:
        if any(kw in text for kw in keywords):
            tags.append(tag)
    return ",".join(tags) if tags else ""


def auto_tag_report_segments(conn: sqlite3.Connection) -> int:
    """遍历 report_segments，按关键词打标并 UPDATE tags。返回被更新的行数。"""
    cur = conn.cursor()
    cur.execute("SELECT id, content FROM report_segments")
    rows = cur.fetchall()
    updated = 0
    for row in rows:
        seg_id, content = row[0], row[1]
        tags = _extract_tags(content)
        if tags:
            cur.execute("UPDATE report_segments SET tags = ? WHERE id = ?", (tags, seg_id))
            updated += 1
    conn.commit()
    return updated


def insert_mock_holdings(conn: sqlite3.Connection) -> int:
    """向 user_portfolio_holdings 插入两条模拟持仓（全球股票 / 基金 A、基金 B），已存在则跳过。"""
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM user_portfolio_holdings WHERE portfolio_type=? AND asset_class=? AND product_name=? LIMIT 1",
        ("平衡型", "全球股票", "基金 A"),
    )
    if cur.fetchone():
        return 0
    now = datetime.now().isoformat()
    rows = [
        ("平衡型", "全球股票", "基金 A", 0.1, 0.008, "来自 A 基金", now),
        ("平衡型", "全球股票", "基金 B", 0.1, 0.006, "来自 B 基金", now),
    ]
    cur.executemany(
        """INSERT INTO user_portfolio_holdings
           (portfolio_type, asset_class, product_name, weight, fee_rate, remarks, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


def count_tagged_segments(conn: sqlite3.Connection) -> int:
    """返回 tags 不为空的 report_segments 记录数。"""
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) FROM report_segments WHERE tags IS NOT NULL AND TRIM(COALESCE(tags, '')) != ''"
    )
    return cur.fetchone()[0]


def main() -> None:
    if not DB_PATH.exists():
        print(f"数据库不存在: {DB_PATH}")
        return
    conn = sqlite3.connect(DB_PATH)
    try:
        n_updated = auto_tag_report_segments(conn)
        print(f"自动打标: 已更新 {n_updated} 条 report_segments 的 tags。")

        n_inserted = insert_mock_holdings(conn)
        print(f"模拟持仓: 已插入 {n_inserted} 条 user_portfolio_holdings。")

        tagged_count = count_tagged_segments(conn)
        print(f"验证: tags 不为空的 report_segments 记录总数 = {tagged_count}")
    finally:
        conn.close()
    print("数据增强完成。")


if __name__ == "__main__":
    main()
