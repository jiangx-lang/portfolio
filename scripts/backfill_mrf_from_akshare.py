#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MRF(968xxx) 净值回填脚本（标准口径）。

与主系统对齐：
- 直接写 nav_history（不再写 mrf_nav）
- 字段映射：编号->isin, 基金净值日期->nav_date, 单位净值->nav
- ccy 默认 HKD（可按 fund_list 覆盖）
"""

from __future__ import annotations

import os
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict

import pandas as pd

NAV_DB = os.environ.get("NAV_HISTORY_DB", "/root/data/nav_history.db")
SLEEP_SEC = float(os.environ.get("MRF_SLEEP_SEC", "0.25"))


def get_conn() -> sqlite3.Connection:
    Path(NAV_DB).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(NAV_DB, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS nav_history (
            isin TEXT NOT NULL,
            ccy TEXT NOT NULL,
            nav_date TEXT NOT NULL,
            nav REAL NOT NULL,
            source TEXT NOT NULL,
            PRIMARY KEY (isin, ccy, nav_date)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fund_list (
            code TEXT NOT NULL,
            isin TEXT NOT NULL,
            ccy TEXT NOT NULL,
            nav_source TEXT,
            yahoo_symbol TEXT
        )
        """
    )
    conn.commit()


def normalize_ymd(v: object) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    if len(s) >= 8 and s[:8].isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return s[:10] if len(s) >= 10 else None


def load_fund_list_ccy(conn: sqlite3.Connection) -> Dict[str, str]:
    ccy_by_code: Dict[str, str] = {}
    try:
        rows = conn.execute("SELECT code, ccy FROM fund_list WHERE code LIKE '968%'").fetchall()
        for code, ccy in rows:
            c = str(code or "").strip()
            if c:
                ccy_by_code[c] = (str(ccy or "").strip().upper() or "HKD")
    except Exception:
        pass
    return ccy_by_code


def get_last_date(conn: sqlite3.Connection, isin: str, ccy: str) -> str | None:
    row = conn.execute(
        "SELECT MAX(nav_date) FROM nav_history WHERE isin = ? AND ccy = ?",
        (isin, ccy),
    ).fetchone()
    if not row or not row[0]:
        return None
    return str(row[0])[:10]


def fetch_hk_code_map(ak) -> pd.DataFrame:
    rank = ak.fund_hk_rank_em()
    if rank is None or rank.empty:
        return pd.DataFrame()
    if "基金代码" not in rank.columns:
        return pd.DataFrame()
    rank = rank.copy()
    rank["基金代码"] = rank["基金代码"].astype(str).str.strip()
    rank = rank[rank["基金代码"].str.startswith("968")].drop_duplicates(subset=["基金代码"], keep="first")
    return rank


def choose_hk_code_col(rank: pd.DataFrame) -> str | None:
    cols = [c for c in rank.columns if "香港" in str(c)]
    return cols[0] if cols else None


def backfill(history: bool) -> int:
    try:
        import akshare as ak
    except Exception:
        print("缺少依赖：pip install akshare pandas")
        return 0

    conn = get_conn()
    ensure_schema(conn)
    ccy_by_code = load_fund_list_ccy(conn)

    rank = fetch_hk_code_map(ak)
    if rank.empty:
        print("AKShare fund_hk_rank_em 无可用 968 列表")
        conn.close()
        return 0

    hk_col = choose_hk_code_col(rank)
    if not hk_col:
        print("未找到香港基金代码列")
        conn.close()
        return 0

    today = datetime.now().strftime("%Y-%m-%d")
    floor_day = (datetime.now() - timedelta(days=365 * 5)).strftime("%Y-%m-%d")
    inserted_total = 0
    cur = conn.cursor()

    for idx, (_, row) in enumerate(rank.iterrows(), start=1):
        code_968 = str(row.get("基金代码") or "").strip()
        hk_code = str(row.get(hk_col) or "").strip()
        if not code_968 or not hk_code or hk_code.lower() == "nan":
            continue

        ccy = ccy_by_code.get(code_968, "HKD")
        last_date = get_last_date(conn, code_968, ccy)
        start_date = floor_day if history or not last_date else last_date
        local_inserted = 0

        try:
            ndf = ak.fund_hk_fund_hist_em(code=hk_code, symbol="历史净值明细")
        except Exception:
            ndf = None
        time.sleep(SLEEP_SEC)
        if ndf is None or ndf.empty:
            continue

        date_col = next((c for c in ndf.columns if "日期" in str(c) or "date" in str(c).lower()), ndf.columns[0])
        nav_col = (
            next((c for c in ndf.columns if "单位净值" in str(c)), None)
            or next((c for c in ndf.columns if "净值" in str(c)), None)
            or (ndf.columns[1] if len(ndf.columns) > 1 else None)
        )
        if nav_col is None:
            continue

        for _, r in ndf.iterrows():
            d = normalize_ymd(r.get(date_col))
            if not d or d < start_date or d > today:
                continue
            if last_date and d <= last_date:
                continue
            try:
                nav = float(r.get(nav_col))
            except Exception:
                continue
            if nav <= 0:
                continue
            cur.execute(
                "INSERT OR IGNORE INTO nav_history (isin, ccy, nav_date, nav, source) VALUES (?,?,?,?,?)",
                (code_968, ccy, d, round(nav, 6), "akshare"),
            )
            local_inserted += cur.rowcount

        inserted_total += local_inserted
        if idx <= 5 or idx % 20 == 0:
            print(f"[{idx}/{len(rank)}] {code_968} +{local_inserted}")

    conn.commit()
    conn.close()
    print(f"完成：新增 {inserted_total} 条到 nav_history")
    return inserted_total


def main() -> None:
    history = "--history" in os.sys.argv
    print(f"MRF backfill -> nav_history, mode={'history' if history else 'incremental'}")
    backfill(history)


if __name__ == "__main__":
    main()

