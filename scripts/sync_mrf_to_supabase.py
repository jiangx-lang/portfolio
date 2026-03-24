#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将本地 MRF 基金基础信息同步到 Supabase fund_list。

目标：
1) 读取本地 mrf_funds 数据源（SQL 种子 + sc_product_code 更新脚本）
2) 写入 Supabase fund_list，保证 calc_performance 等脚本可按 code 找到基金

环境变量（必须）：
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

可选：
  MRF_DEFAULT_CCY (默认 HKD)
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).resolve().parent.parent
SCHEMA_SQL = ROOT / "scripts" / "mrf_funds_schema.sql"
CODE_UPDATES_SQL = ROOT / "mrf_funds_sc_product_code_updates.sql"


def _load_env_files() -> None:
    """尽量加载项目 .env / dashboard .env.local（不依赖 python-dotenv 也可工作）。"""
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(ROOT / ".env")
        load_dotenv(ROOT / "mf-holdings-dashboard" / ".env.local")
    except Exception:
        for p in [ROOT / ".env", ROOT / "mf-holdings-dashboard" / ".env.local"]:
            if not p.exists():
                continue
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _parse_sql_string(s: str) -> str:
    return s.replace("''", "'")


def _read_seed_funds_from_sql(path: Path) -> List[Dict[str, str]]:
    """
    解析 scripts/mrf_funds_schema.sql 中 INSERT ... VALUES (...)。
    仅提取 fund_name，其他字段本任务不依赖。
    """
    if not path.exists():
        raise FileNotFoundError(f"未找到种子 SQL: {path}")
    text = path.read_text(encoding="utf-8")

    # 抓取所有四元组：('基金名','品牌',70,25,5,3.0) 这里只用基金名
    rows: List[Dict[str, str]] = []
    pattern = re.compile(
        r"\(\s*'((?:[^']|'')+)'\s*,\s*'((?:[^']|'')+)'\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*\)"
    )
    for m in pattern.finditer(text):
        fund_name = _parse_sql_string(m.group(1)).strip()
        brand = _parse_sql_string(m.group(2)).strip()
        if fund_name:
            rows.append({"fund_name": fund_name, "brand": brand})
    return rows


_CODE_968_RE = re.compile(r"^968\d{3,}$")


def _normalize_968_code(v: str | None) -> str:
    s = str(v or "").strip().upper()
    return s if _CODE_968_RE.match(s) else ""


def _read_sc_product_code_updates(path: Path) -> Dict[str, str]:
    """解析 mrf_funds_sc_product_code_updates.sql 中 UPDATE 语句。"""
    mapping: Dict[str, str] = {}
    if not path.exists():
        return mapping
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"UPDATE\s+mrf_funds\s+SET\s+sc_product_code\s*=\s*'([^']+)'\s+WHERE\s+fund_name\s*=\s*'([^']+)'\s*;",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        code = _normalize_968_code(m.group(1))
        name = m.group(2).strip()
        if name and code:
            mapping[name] = code
    return mapping


def _infer_ccy(sc_product_code: str | None, default_ccy: str) -> str:
    c = (sc_product_code or "").strip().upper()
    if c.endswith("USD"):
        return "USD"
    if c.endswith("HKD"):
        return "HKD"
    if c.endswith("CNY"):
        return "CNY"
    return default_ccy.upper()


def _fallback_code_by_name(fund_name: str) -> str:
    # 无 sc_product_code 的基金给一个稳定 code，避免 fund_list 空 code
    digest = hashlib.md5(fund_name.encode("utf-8")).hexdigest()[:8].upper()
    return f"MRF{digest}"


def _build_fund_list_rows(seed_rows: List[Dict[str, str]], code_map: Dict[str, str], default_ccy: str) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen_keys: set[tuple[str, str]] = set()
    skipped_dups = 0
    skipped_no_968 = 0
    for r in seed_rows:
        fund_name = r["fund_name"].strip()
        # 统一 MRF 唯一标识：优先 sc_product_code，兼容 sec_code / external_code
        sc_code = _normalize_968_code(
            code_map.get(fund_name)
            or r.get("sc_product_code")
            or r.get("sec_code")
            or r.get("external_code")
        )
        if not sc_code:
            skipped_no_968 += 1
            print(f"[skip] 缺少 968 数字代码: {fund_name}")
            continue
        code = sc_code
        ccy = _infer_ccy(sc_code or None, default_ccy)
        # 若无真实 isin，使用稳定占位：优先 sc_product_code，否则 code
        isin = sc_code or code
        k = (isin, ccy)
        if k in seen_keys:
            skipped_dups += 1
            continue
        seen_keys.add(k)
        out.append(
            {
                "code": code,
                "isin": isin,
                "ccy": ccy,
                "type": "mrf",
                "sc_product_code": sc_code or None,
                "nav_source": "mrf",
                "bbg": None,
            }
        )
    if skipped_dups:
        print(f"检测到重复 (isin,ccy) 并跳过: {skipped_dups} 条")
    if skipped_no_968:
        print(f"缺少 968 数字代码并跳过: {skipped_no_968} 条")
    return out


def _get_supabase_client():
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise EnvironmentError("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
    from supabase import create_client  # type: ignore

    return create_client(url, key)


def _upsert_fund_list(sb, rows: List[Dict[str, str]]) -> None:
    """
    fund_list 典型主键是 (isin, ccy)，先尝试带 sc_product_code upsert；
    若目标表无该列，自动回退为不带该列的 upsert。
    """
    if not rows:
        print("无可同步数据。")
        return
    page = 500
    for i in range(0, len(rows), page):
        batch = rows[i : i + page]
        try:
            sb.table("fund_list").upsert(batch, on_conflict="isin,ccy").execute()
        except Exception as e:
            msg = str(e).lower()
            if "sc_product_code" in msg and ("column" in msg or "schema cache" in msg):
                stripped = [{k: v for k, v in r.items() if k != "sc_product_code"} for r in batch]
                sb.table("fund_list").upsert(stripped, on_conflict="isin,ccy").execute()
            else:
                raise
    print(f"fund_list upsert 完成，共 {len(rows)} 条。")


def main() -> int:
    _load_env_files()
    default_ccy = (os.environ.get("MRF_DEFAULT_CCY") or "HKD").strip().upper()

    try:
        seed_rows = _read_seed_funds_from_sql(SCHEMA_SQL)
        code_map = _read_sc_product_code_updates(CODE_UPDATES_SQL)
        rows = _build_fund_list_rows(seed_rows, code_map, default_ccy)
        print(f"本地 MRF 基金读取：{len(seed_rows)} 条，含 sc_product_code：{sum(1 for r in rows if r.get('sc_product_code'))} 条")
        sb = _get_supabase_client()
        _upsert_fund_list(sb, rows)
        return 0
    except Exception as e:
        print(f"[sync_mrf_to_supabase] 失败: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

