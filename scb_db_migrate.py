# -*- coding: utf-8 -*-
"""
scb_reports.db 架构升级：用户持仓穿透、机构配比模板、主题标签
- 执行前自动备份原库
- 新增 user_portfolio_holdings / portfolio_templates，为 report_segments 增加 tags
- 费率空值按 0.5% 处理；tags 逗号分隔便于 LIKE 查询
"""
from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(r"d:\house view\scb_reports.db")
BACKUP_DIR = DB_PATH.parent


def backup_db() -> Path:
    """备份当前 .db 文件，返回备份路径。"""
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"scb_reports_backup_{stamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    print(f"已备份: {backup_path}")
    return backup_path


def run_migrations(conn: sqlite3.Connection) -> None:
    """执行表结构新增/修改，不破坏 is_vectorized 等既有字段。"""
    cur = conn.cursor()

    # 表 B：机构标准配比表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_type TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            standard_weight REAL NOT NULL,
            UNIQUE(portfolio_type, asset_class)
        )
    """)

    # 表 A：用户持仓详情表（weight 为在该资产类别下的占比）
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_portfolio_holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_type TEXT NOT NULL,
            asset_class TEXT NOT NULL,
            product_name TEXT NOT NULL,
            weight REAL NOT NULL,
            fee_rate REAL,
            remarks TEXT,
            last_updated TEXT
        )
    """)

    # 表 C：report_segments 增加 tags（逗号分隔，如 "Japan,Equity"）
    try:
        cur.execute("ALTER TABLE report_segments ADD COLUMN tags TEXT")
        print("report_segments 已添加列: tags")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("report_segments.tags 已存在，跳过")
        else:
            raise

    conn.commit()
    print("表结构迁移完成。")


def seed_data(conn: sqlite3.Connection) -> None:
    """
    初始化数据：
    - portfolio_templates：平衡型 全球股票 60%、DM 投资级债券 30%、黄金 10%
    - user_portfolio_holdings：平衡型下「全球股票」穿透为基金 A 30%、基金 B 30%，备注注明来自 A+B
    同一 portfolio_type 下同一 asset_class 的 weight 之和 = 该资产类别总占比。
    """
    cur = conn.cursor()

    # 若已有平衡型模板则跳过（可改为 DELETE 后插入以重复运行）
    cur.execute("SELECT 1 FROM portfolio_templates WHERE portfolio_type = ? LIMIT 1", ("平衡型",))
    if cur.fetchone():
        print("portfolio_templates 平衡型 已存在，跳过 seed。")
        conn.commit()
        return

    cur.executemany(
        """INSERT INTO portfolio_templates (portfolio_type, asset_class, standard_weight) VALUES (?, ?, ?)""",
        [
            ("平衡型", "全球股票", 0.60),
            ("平衡型", "DM投资级债券", 0.30),
            ("平衡型", "黄金", 0.10),
        ],
    )

    # 穿透：全球股票 60% 由 基金A 30% + 基金B 30% 构成（30+30=60，占该资产类别 100%）
    # 这里 weight 表示「在该资产类别下的占比」，故 0.5 + 0.5 = 1.0 对应 60% 的全球股票
    cur.executemany(
        """INSERT INTO user_portfolio_holdings
           (portfolio_type, asset_class, product_name, weight, fee_rate, remarks, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            ("平衡型", "全球股票", "基金A", 0.50, 0.008, "来自 A + B 构成", datetime.now().isoformat()),
            ("平衡型", "全球股票", "基金B", 0.50, 0.007, "来自 A + B 构成", datetime.now().isoformat()),
            ("平衡型", "DM投资级债券", "债券基金C", 1.0, 0.004, None, datetime.now().isoformat()),
            ("平衡型", "黄金", "黄金ETF D", 1.0, 0.005, None, datetime.now().isoformat()),
        ],
    )
    conn.commit()
    print("Seed 数据已插入（平衡型 + 穿透持仓）。")


def validate_balance_revenue(conn: sqlite3.Connection, aum: float = 1_000_000.0) -> float:
    """
    验证：平衡型组合的总预计年化收入（Revenue）
    公式：AUM * SUM( standard_weight * weight * COALESCE(fee_rate, 0.005) )
    fee_rate 为空时按 0.5% 计算。
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT
            SUM(t.standard_weight * h.weight * COALESCE(h.fee_rate, 0.005)) AS total_fee_factor
        FROM user_portfolio_holdings h
        JOIN portfolio_templates t
          ON h.portfolio_type = t.portfolio_type AND h.asset_class = t.asset_class
        WHERE h.portfolio_type = '平衡型'
    """)
    row = cur.fetchone()
    factor = row[0] if row and row[0] is not None else 0.0
    revenue = aum * factor
    print(f"平衡型 总预计年化收入 (AUM={aum:,.0f}): {revenue:,.2f} 元 (费率因子 SUM={factor:.6f})")
    return revenue


def main() -> None:
    if not DB_PATH.exists():
        print(f"数据库不存在: {DB_PATH}")
        return
    backup_db()
    conn = sqlite3.connect(DB_PATH)
    try:
        run_migrations(conn)
        seed_data(conn)
        validate_balance_revenue(conn)
    finally:
        conn.close()
    print("全部完成。")


if __name__ == "__main__":
    main()
