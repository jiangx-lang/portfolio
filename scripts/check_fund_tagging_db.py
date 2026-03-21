#!/usr/bin/env python3
"""
诊断 fund_tagging.db：检查 fund_tag_map 与 tag_taxonomy 的数据。
可在本机或腾讯云运行：python scripts/check_fund_tagging_db.py
"""
import os
import sqlite3
import sys
from pathlib import Path

# 项目根
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

def get_tag_db_path():
    try:
        from config import FUND_TAGGING_DB
        return Path(FUND_TAGGING_DB)
    except ImportError:
        pass
    env_db = os.environ.get("FUND_TAGGING_DB", "fund_tagging.db")
    if Path(env_db).is_absolute():
        return Path(env_db)
    # 常见位置
    for base in [ROOT, ROOT / "qdii_portfolio", Path("/root/data")]:
        p = base / "fund_tagging.db" if env_db == "fund_tagging.db" else base / env_db
        if p.exists():
            return p
    return ROOT / "qdii_portfolio" / "fund_tagging.db"

def main():
    db_path = get_tag_db_path()
    print(f"DB path: {db_path}")
    print(f"Exists: {db_path.exists()}")
    if not db_path.exists():
        print("数据库文件不存在。请确认 FUND_TAGGING_DB 或 config 中的路径。")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 1. 表结构
    print("\n--- fund_tag_map 列 ---")
    cur = conn.execute("PRAGMA table_info(fund_tag_map)")
    for row in cur:
        print(f"  {row['name']} {row['type']}")

    # 2. 按标签名汇总：tag_name, 样本 aggregated_score
    print("\n--- 标签与得分样本 (tag_name, aggregated_score) LIMIT 20 ---")
    try:
        rows = conn.execute("""
            SELECT tt.tag_name, ftm.aggregated_score
            FROM fund_tag_map ftm
            JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
            ORDER BY ftm.aggregated_score DESC
            LIMIT 20
        """).fetchall()
        if not rows:
            print("  (无数据)")
        for r in rows:
            score = r["aggregated_score"]
            print(f"  {r['tag_name']!r}  ->  {score}  (type={type(score).__name__})")
    except Exception as e:
        print(f"  查询失败: {e}")

    # 3. 某只基金的标签（取 fund_id 为有数据的第一个）
    print("\n--- 单只基金标签 (某 fund_id 的 tag_name, aggregated_score) ---")
    try:
        fid_row = conn.execute(
            "SELECT fund_id FROM fund_tag_map LIMIT 1"
        ).fetchone()
        if fid_row:
            fid = fid_row["fund_id"]
            rows = conn.execute("""
                SELECT tt.tag_name, tt.category, ftm.aggregated_score
                FROM fund_tag_map ftm
                JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
                WHERE ftm.fund_id = ?
                ORDER BY ftm.aggregated_score DESC
            """, (fid,)).fetchall()
            print(f"  fund_id={fid}, 共 {len(rows)} 条")
            for r in rows[:10]:
                print(f"    {r['tag_name']}  {r['aggregated_score']}  ({r['category']})")
        else:
            print("  fund_tag_map 无数据")
    except Exception as e:
        print(f"  查询失败: {e}")

    conn.close()
    print("\n完成。若 aggregated_score 全为 0，需在服务器执行: python -m fund_tagging.run --db <path> aggregate")

if __name__ == "__main__":
    main()
