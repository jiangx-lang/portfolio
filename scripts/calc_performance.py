# -*- coding: utf-8 -*-
"""
calc_performance.py
════════════════════════════════════════════════════════════════
从 Supabase nav_history 按 (isin, ccy) 计算各区间收益率，经 fund_list 映射为
fund_code 后 upsert 到 fund_performance。

与前端约定：数值为百分点（如 1.2345 表示 +1.2345%），保留 4 位小数。

依赖：pip install supabase python-dotenv
环境变量（与仓库其他脚本对齐，优先 service role 以便写入）：
  SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY（推荐）或 SUPABASE_SERVICE_KEY 或 SUPABASE_KEY

建议在 NAV 同步任务之后运行（如 crontab 22:30，晚于 nav sync）：
  cd /path/to/portfolio && python scripts/calc_performance.py >> logs/perf.log 2>&1
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

# 与 supabase_sync.py / cloud_update_nav 一致：可从项目 .env 加载
try:
    from dotenv import load_dotenv

    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_root, ".env"))
    _qd_env = os.path.join(_root, "qdii_portfolio", ".env")
    if os.path.isfile(_qd_env):
        load_dotenv(_qd_env)
    _mf_env = os.path.join(_root, "mf-holdings-dashboard", ".env.local")
    if os.path.isfile(_mf_env):
        load_dotenv(_mf_env)
except ImportError:
    pass

# ── Supabase 表与字段（以仓库内实际 nav_history 为准）────────────────
NAV_TABLE = "nav_history"
FUND_LIST_TABLE = "fund_list"
PERF_TABLE = "fund_performance"

# nav_history: PRIMARY KEY (isin, ccy, nav_date)
ISIN_COL = "isin"
CCY_COL = "ccy"
NAV_DATE_COL = "nav_date"
NAV_COL = "nav"

# fund_list: code, isin, ccy — PK (isin, ccy)
FUND_CODE_COL = "code"

# 各时间段回溯自然日（与产品口径一致即可微调）
PERIODS: Dict[str, int] = {
    "daily_return": 1,
    "weekly_return": 7,
    "monthly_1": 30,
    "monthly_3": 91,
    "monthly_6": 182,
    "yearly_1": 365,
}


def _get_supabase():
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    ).strip()
    if not url or not key:
        raise EnvironmentError(
            "缺少 SUPABASE_URL 与可写密钥：请设置 SUPABASE_SERVICE_ROLE_KEY（推荐）或 SUPABASE_SERVICE_KEY / SUPABASE_KEY"
        )
    from supabase import create_client

    return create_client(url, key)


def fetch_fund_list_map(sb) -> Dict[Tuple[str, str], str]:
    """(isin, ccy) -> fund_list.code（与 QD API fund_performance 关联字段一致）"""
    print("正在拉取 fund_list …")
    rows: List[dict] = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table(FUND_LIST_TABLE)
            .select(f"{FUND_CODE_COL},{ISIN_COL},{CCY_COL}")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    m: Dict[Tuple[str, str], str] = {}
    for r in rows:
        isin = str(r.get(ISIN_COL) or "").strip()
        ccy = str(r.get(CCY_COL) or "USD").strip().upper()
        code = str(r.get(FUND_CODE_COL) or "").strip()
        if isin and code:
            m[(isin, ccy)] = code
    print(f"  fund_list 共 {len(rows)} 行，映射键 {len(m)} 个 (isin,ccy)")
    return m


def fetch_nav_history_grouped(sb) -> Dict[Tuple[str, str], List[dict]]:
    """分页拉取 nav_history，按 (isin, ccy) 分组，组内按 nav_date 升序"""
    print("正在拉取 nav_history …")
    all_rows: List[dict] = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table(NAV_TABLE)
            .select(f"{ISIN_COL},{CCY_COL},{NAV_DATE_COL},{NAV_COL}")
            .order(ISIN_COL, desc=False)
            .order(CCY_COL, desc=False)
            .order(NAV_DATE_COL, desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    print(f"  共 {len(all_rows)} 条 NAV 记录")

    grouped: Dict[Tuple[str, str], List[dict]] = {}
    for row in all_rows:
        isin = str(row.get(ISIN_COL) or "").strip()
        ccy = str(row.get(CCY_COL) or "").strip().upper()
        if not isin:
            continue
        key = (isin, ccy)
        grouped.setdefault(key, []).append(row)
    for key in grouped:
        grouped[key].sort(key=lambda r: str(r.get(NAV_DATE_COL, ""))[:10])
    print(f"  分组后 {len(grouped)} 只 (isin, ccy) 序列")
    return grouped


def find_nav_on_or_before(records: List[dict], target_date: date) -> Optional[float]:
    """records 已按日期升序，取最后一个 nav_date <= target_date 的净值"""
    result: Optional[float] = None
    for row in records:
        raw = row.get(NAV_DATE_COL)
        if raw is None:
            continue
        row_date = date.fromisoformat(str(raw)[:10])
        if row_date <= target_date:
            try:
                result = float(row[NAV_COL])
            except (TypeError, ValueError):
                pass
        else:
            break
    return result


def calc_return(nav_end: float, nav_start: Optional[float]) -> Optional[float]:
    if nav_start is None or nav_start == 0:
        return None
    return round((nav_end - nav_start) / nav_start * 100, 4)


def compute_rows(
    nav_by_pair: Dict[Tuple[str, str], List[dict]],
    list_map: Dict[Tuple[str, str], str],
) -> List[dict]:
    results: List[dict] = []
    for (isin, ccy), records in nav_by_pair.items():
        if not records:
            continue
        fund_code = list_map.get((isin, ccy))
        if not fund_code:
            continue
        latest = records[-1]
        try:
            latest_date = date.fromisoformat(str(latest[NAV_DATE_COL])[:10])
            latest_nav = float(latest[NAV_COL])
        except (KeyError, TypeError, ValueError):
            continue

        row: Dict[str, Any] = {
            "fund_code": fund_code,
            "nav_date": str(latest_date),
        }
        for field, days in PERIODS.items():
            start_d = latest_date - timedelta(days=days)
            start_nav = find_nav_on_or_before(records, start_d)
            row[field] = calc_return(latest_nav, start_nav)

        results.append(row)

    # 同一 fund_code 若对应多条 (isin,ccy)（异常数据），保留 nav_date 最新的一条
    by_code: Dict[str, dict] = {}
    for row in results:
        fc = str(row.get("fund_code") or "")
        if not fc:
            continue
        prev = by_code.get(fc)
        if prev is None or str(row.get("nav_date") or "") > str(prev.get("nav_date") or ""):
            by_code[fc] = row
    out = list(by_code.values())
    print(f"  去重后 fund_code：{len(out)} 条")
    return out


def upsert_performance(sb, rows: List[dict]) -> None:
    if not rows:
        print("  无数据需要写入")
        return
    batch_size = 200
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        sb.table(PERF_TABLE).upsert(batch, on_conflict="fund_code").execute()
        total += len(batch)
        print(f"  已写入 {total}/{len(rows)} 条")
    print(f"  全部写入完成：{len(rows)} 条")


def main() -> int:
    try:
        sb = _get_supabase()
    except Exception as e:
        print(e, file=sys.stderr)
        return 1

    list_map = fetch_fund_list_map(sb)
    nav_by_pair = fetch_nav_history_grouped(sb)
    rows = compute_rows(nav_by_pair, list_map)
    upsert_performance(sb, rows)
    print("calc_performance.py 运行完成 ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
