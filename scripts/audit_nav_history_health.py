#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
nav_history 流水线健康检查：QD + MRF 数据行是否满足统一“底盘”协议，
以及 fund_list 是否能接上 calc_performance 的 (isin, ccy) 映射。

退出码：0 = PASS，1 = FAIL（或无法连接数据源）。
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    from dotenv import load_dotenv

    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_root, ".env"))
    for _p in (
        os.path.join(_root, "qdii_portfolio", ".env"),
        os.path.join(_root, "mf-holdings-dashboard", ".env.local"),
    ):
        if os.path.isfile(_p):
            load_dotenv(_p)
except ImportError:
    pass

YMD = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MRF_ISIN = re.compile(r"^968\d{3,}$")  # 968 + 至少 3 位数字（覆盖 968001 等）

# 协议期望（文档）；MRF source 代码库多为 "akshare"，此处同时接受
EXPECTED_MRF_SOURCES = ("akshare_mrf", "akshare")
EXPECTED_QD_SOURCES = ("yahoo", "FT", "ft")  # 常见 QD 来源


def _rows_failures(rows: List[dict], *, mrf_slice: bool) -> List[str]:
    bad: List[str] = []
    for i, r in enumerate(rows):
        isin = str(r.get("isin") or "").strip()
        ccy = str(r.get("ccy") or "").strip()
        nd = str(r.get("nav_date") or "")[:10]
        src = str(r.get("source") or "").strip()
        nav = r.get("nav")
        tag = f"row[{i}] isin={isin!r}"

        if not isin:
            bad.append(f"{tag}: empty isin")
            continue
        if not ccy:
            bad.append(f"{tag}: empty ccy")
        if not YMD.match(nd):
            bad.append(f"{tag}: nav_date not YYYY-MM-DD: {nd!r}")
        try:
            nv = float(nav)
            if nv <= 0:
                bad.append(f"{tag}: nav<=0")
        except (TypeError, ValueError):
            bad.append(f"{tag}: nav not numeric: {nav!r}")
        if not src:
            bad.append(f"{tag}: empty source")

        if mrf_slice:
            if not MRF_ISIN.match(isin):
                bad.append(f"{tag}: MRF sample but isin not 968… pattern")
            if ccy.upper() != "HKD":
                bad.append(f"{tag}: MRF 期望 ccy=HKD，实际 {ccy!r}")
            if src and src not in EXPECTED_MRF_SOURCES:
                bad.append(
                    f"{tag}: MRF source 期望 {EXPECTED_MRF_SOURCES} 之一，实际 {src!r}"
                )
        else:
            if MRF_ISIN.match(isin):
                continue
            if src and src not in EXPECTED_QD_SOURCES and src not in EXPECTED_MRF_SOURCES:
                # 允许未知 source 仅告警，不判 FAIL（避免 FT/yahoo 以外合法来源）
                pass
    return bad


def _get_supabase():
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not url or not key:
        return None
    from supabase import create_client

    return create_client(url, key)


def _fetch_nav_samples_sb(sb) -> Tuple[List[dict], List[dict]]:
    """MRF 行（isin like 968%）与非 968 行各取一批。"""
    mrf = (
        sb.table("nav_history")
        .select("isin,ccy,nav_date,nav,source")
        .like("isin", "968%")
        .limit(200)
        .execute()
    )
    qd = (
        sb.table("nav_history")
        .select("isin,ccy,nav_date,nav,source")
        .not_.like("isin", "968%")
        .limit(200)
        .execute()
    )
    return (mrf.data or []), (qd.data or [])


def _fetch_fund_list_keys_sb(sb) -> Set[Tuple[str, str]]:
    rows: List[dict] = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table("fund_list")
            .select("code,isin,ccy")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    s: Set[Tuple[str, str]] = set()
    for r in rows:
        isin = str(r.get("isin") or "").strip()
        ccy = str(r.get("ccy") or "USD").strip().upper()
        if isin:
            s.add((isin, ccy))
    return s


def _distinct_mrf_pairs_sb(sb) -> Set[Tuple[str, str]]:
    """nav_history 中出现的 (isin,ccy)，isin 以 968 开头。"""
    data = (
        sb.table("nav_history")
        .select("isin,ccy")
        .like("isin", "968%")
        .limit(5000)
        .execute()
    )
    pairs: Set[Tuple[str, str]] = set()
    for r in data.data or []:
        isin = str(r.get("isin") or "").strip()
        ccy = str(r.get("ccy") or "").strip().upper() or "HKD"
        if isin:
            pairs.add((isin, ccy))
    return pairs


def audit_supabase(sb) -> Tuple[bool, List[str]]:
    notes: List[str] = []
    try:
        mrf_rows, qd_rows = _fetch_nav_samples_sb(sb)
    except Exception as e:
        return False, [f"拉取 nav_history 失败: {e}"]

    notes.append(f"样本: MRF(968…) {len(mrf_rows)} 条, 非968 {len(qd_rows)} 条")
    if len(mrf_rows) == 0:
        notes.append(
            "FAIL: Supabase nav_history 中未找到 isin LIKE '968%' 的记录，无法验证 MRF 流水线是否写入。"
        )

    bad_m = _rows_failures(mrf_rows, mrf_slice=True)
    bad_q = _rows_failures(qd_rows, mrf_slice=False)

    try:
        fl_keys = _fetch_fund_list_keys_sb(sb)
        mrf_pairs = _distinct_mrf_pairs_sb(sb)
    except Exception as e:
        return False, notes + [f"拉取 fund_list / MRF pairs 失败: {e}"]

    missing_fl = sorted(mrf_pairs - fl_keys)
    if missing_fl:
        bad_m.append(
            f"fund_list 缺少 {len(missing_fl)} 个 (isin,ccy) 键（calc_performance 将无法写入这些 968）"
        )
        notes.append(f"缺失 fund_list 示例（最多5个）: {missing_fl[:5]}")

    all_bad = bad_m + bad_q
    ok = len(all_bad) == 0 and len(mrf_rows) > 0
    return ok, notes + all_bad


def audit_sqlite(db_path: str) -> Tuple[bool, List[str]]:
    notes: List[str] = []
    if not os.path.isfile(db_path):
        return False, [f"SQLite 文件不存在: {db_path}"]
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            """
            SELECT isin, ccy, nav_date, nav, source FROM nav_history
            WHERE isin LIKE '968%' LIMIT 200
            """
        )
        mrf_rows = [dict(r) for r in cur.fetchall()]
        cur = conn.execute(
            """
            SELECT isin, ccy, nav_date, nav, source FROM nav_history
            WHERE isin NOT LIKE '968%' LIMIT 200
            """
        )
        qd_rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    notes.append(f"SQLite 样本: MRF {len(mrf_rows)} 条, 非968 {len(qd_rows)} 条")
    if len(mrf_rows) == 0:
        notes.append(
            "FAIL: 本地库中无 isin LIKE '968%' 的 nav_history 行，无法验证 MRF 回填。"
        )
    bad_m = _rows_failures(mrf_rows, mrf_slice=True)
    bad_q = _rows_failures(qd_rows, mrf_slice=False)

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.execute(
            "SELECT DISTINCT isin, ccy FROM nav_history WHERE isin LIKE '968%'"
        )
        mrf_pairs = {(str(r[0]).strip(), str(r[1] or "HKD").strip().upper()) for r in cur.fetchall()}
        cur = conn.execute("SELECT isin, ccy FROM fund_list")
        fl_keys = {
            (str(r[0]).strip(), str(r[1] or "USD").strip().upper())
            for r in cur.fetchall()
            if str(r[0] or "").strip()
        }
    finally:
        conn.close()

    missing_fl = sorted(mrf_pairs - fl_keys)
    if missing_fl:
        bad_m.append(
            f"fund_list 缺少 {len(missing_fl)} 个 (isin,ccy) 键"
        )
        notes.append(f"缺失 fund_list 示例（最多5个）: {missing_fl[:5]}")

    all_bad = bad_m + bad_q
    ok = len(all_bad) == 0 and len(mrf_rows) > 0
    return ok, notes + all_bad


def main() -> int:
    print("=== nav_history 流水线健康检查 ===\n")

    sb = _get_supabase()
    if sb:
        print("数据源: Supabase")
        ok, lines = audit_supabase(sb)
    else:
        db = (
            os.environ.get("NAV_HISTORY_DB")
            or os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "nav_history.db",
            )
        )
        print(f"数据源: SQLite ({db})")
        ok, lines = audit_sqlite(db)

    for line in lines:
        print(line)

    # 静态审计：calc_performance 是否带 nav_date 下界
    calc_path = os.path.join(os.path.dirname(__file__), "calc_performance.py")
    try:
        with open(calc_path, encoding="utf-8") as f:
            calc_src = f.read()
        if "gte" in calc_src and "nav_date" in calc_src:
            print("\n[提示] calc_performance.py 内含 nav_date 的 gte 过滤。")
        else:
            print(
                "\n[提示] 当前 calc_performance.py **未**对 nav_history 使用 gte(nav_date, …)；"
                "全表分页拉取。若需减负需在脚本内自行加过滤。"
            )
    except OSError:
        pass

    print("\n结果:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
