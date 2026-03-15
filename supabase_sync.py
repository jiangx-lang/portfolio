# -*- coding: utf-8 -*-
"""
supabase_sync.py
════════════════════════════════════════════════════════════════
把本地 nav_history.db 的净值数据增量同步到 Supabase PostgreSQL。
让 Streamlit Cloud 可以读到最新数据。

使用方法：
  1. 在 Supabase 建表（见下方 SQL）
  2. 设置环境变量 SUPABASE_URL 和 SUPABASE_KEY
  3. 在 qd_download_nav.py 末尾加一行：
       import supabase_sync; supabase_sync.sync()

也可以独立运行：
  python supabase_sync.py              # 同步最近30天
  python supabase_sync.py --days 365  # 同步最近1年
  python supabase_sync.py --all       # 全量同步（首次用）
  python supabase_sync.py --check     # 只检查连接，不同步
"""

import os
import sys
import sqlite3
import logging
from datetime import date, timedelta
from pathlib import Path

# 从 .env 加载 SUPABASE_URL / SUPABASE_KEY（与 app.py 同级的 qdii_portfolio/.env）
try:
    from dotenv import load_dotenv
    load_dotenv()
    _env_dir = Path(__file__).resolve().parent / "qdii_portfolio"
    if _env_dir.exists():
        load_dotenv(_env_dir / ".env")
except ImportError:
    pass

log = logging.getLogger(__name__)

# ── 配置 ─────────────────────────────────────────────────────────
NAV_DB       = os.environ.get("NAV_HISTORY_DB", r"E:\FinancialData\nav_history.db")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")   # anon key 即可（Row Level Security 关掉）

# Supabase 建表 SQL（在 Supabase SQL Editor 里执行一次）:
SUPABASE_DDL = """
-- 在 Supabase SQL Editor 执行这段 SQL（只需一次）

CREATE TABLE IF NOT EXISTS nav_history (
    isin     TEXT    NOT NULL,
    ccy      TEXT    NOT NULL,
    nav_date DATE    NOT NULL,
    nav      NUMERIC NOT NULL,
    source   TEXT    NOT NULL,
    PRIMARY KEY (isin, ccy, nav_date)
);

CREATE TABLE IF NOT EXISTS fund_list (
    code       TEXT NOT NULL,
    isin       TEXT NOT NULL,
    ccy        TEXT NOT NULL,
    bbg        TEXT,
    nav_source TEXT,
    PRIMARY KEY (isin, ccy)
);

-- 允许匿名读取（Streamlit Cloud 用 anon key 读）
ALTER TABLE nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_list   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read nav_history" ON nav_history FOR SELECT USING (true);
CREATE POLICY "public read fund_list"   ON fund_list   FOR SELECT USING (true);
"""


# ── Supabase 客户端 ───────────────────────────────────────────────
def _get_client():
    """返回 supabase-py 客户端，未安装或未配置时返回 None。"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning("SUPABASE_URL / SUPABASE_KEY 未设置，跳过同步")
        return None
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        log.error("请安装: pip install supabase")
        return None
    except Exception as e:
        log.error(f"Supabase 连接失败: {e}")
        return None


# ── 本地 SQLite 读取 ──────────────────────────────────────────────
def _read_local_nav(since_date: str) -> list[dict]:
    """从本地 nav_history.db 读取 since_date 之后的数据。"""
    p = Path(NAV_DB)
    if not p.exists():
        log.error(f"本地数据库不存在: {p}")
        return []
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT isin, ccy, nav_date, nav, source
        FROM nav_history
        WHERE nav_date >= ?
        ORDER BY nav_date
    """, (since_date,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _read_local_fund_list() -> list[dict]:
    p = Path(NAV_DB)
    if not p.exists():
        return []
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT code, isin, ccy, bbg, nav_source FROM fund_list"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── 同步主逻辑 ────────────────────────────────────────────────────
def sync(days: int = 30) -> int:
    """
    增量同步最近 days 天的净值到 Supabase。
    返回同步条数。
    """
    client = _get_client()
    if client is None:
        return 0

    since = (date.today() - timedelta(days=days)).isoformat()
    rows  = _read_local_nav(since)

    if not rows:
        log.info("无新数据需要同步")
        return 0

    # 批量 upsert（每批500条）
    total = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        try:
            client.table("nav_history").upsert(
                batch,
                on_conflict="isin,ccy,nav_date"
            ).execute()
            total += len(batch)
        except Exception as e:
            log.error(f"Supabase upsert 失败 (batch {i//batch_size}): {e}")

    log.info(f"Supabase 同步完成：{total} 条 (最近{days}天)")
    return total


def sync_fund_list() -> int:
    """同步 fund_list 到 Supabase（基金信息变化不频繁，每次全量）。"""
    client = _get_client()
    if client is None:
        return 0
    rows = _read_local_fund_list()
    if not rows:
        return 0
    try:
        client.table("fund_list").upsert(
            rows, on_conflict="isin,ccy"
        ).execute()
        log.info(f"fund_list 同步：{len(rows)} 条")
        return len(rows)
    except Exception as e:
        log.error(f"fund_list 同步失败: {e}")
        return 0


def check_connection() -> bool:
    """检查 Supabase 连接是否正常。"""
    client = _get_client()
    if client is None:
        return False
    try:
        r = client.table("nav_history").select("isin").limit(1).execute()
        count = client.table("nav_history").select(
            "isin", count="exact"
        ).execute()
        total = count.count or 0
        print(f"✅ Supabase 连接正常，nav_history 共 {total} 条记录")
        return True
    except Exception as e:
        print(f"❌ Supabase 连接失败: {e}")
        return False


# ── CLI ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    args = sys.argv[1:]

    if "--check" in args:
        check_connection()

    elif "--all" in args:
        print("全量同步（可能需要几分钟）...")
        n = sync(days=3650)   # 10年
        sync_fund_list()
        print(f"完成：同步 {n} 条净值数据")

    else:
        days = 30
        for a in args:
            if a.startswith("--days="):
                days = int(a.split("=")[1])
            elif a == "--days" and args.index(a)+1 < len(args):
                days = int(args[args.index(a)+1])

        print(f"增量同步最近 {days} 天...")
        n = sync(days=days)
        sync_fund_list()
        print(f"完成：同步 {n} 条")
