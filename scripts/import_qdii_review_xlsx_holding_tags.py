#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将「qdii_标签复核表」Excel 中手工标签导入 holding_tag_map。

读取工作表：全量复核、HALO标签复核（合并同一持仓标准化名的标签，取并集）。
不处理「待补充」sheet（无标签列）。

对出现在上述 sheet 且至少解析出 1 个有效 tag 的持仓：
  先 DELETE 该持仓在 holding_tag_map 的全部行，再 INSERT 解析得到的标签
  （confidence=1.0, source='manual'），使复核表成为该持仓的唯一标签来源。

用法（仓库根目录）:
  py -3 scripts/import_qdii_review_xlsx_holding_tags.py
  py -3 scripts/import_qdii_review_xlsx_holding_tags.py --xlsx "输出/qdii_标签复核表 (1).xlsx"
  py -3 scripts/import_qdii_review_xlsx_holding_tags.py --dry-run

导入后请执行基金层聚合:
  py -3 -m fund_tagging.run --db qdii_portfolio/fund_tagging.db aggregate
  （或 FUND_TAGGING_DB 指向的实际路径）
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import FUND_TAGGING_DB  # noqa: E402

DEFAULT_XLSX = ROOT / "输出" / "qdii_标签复核表 (1).xlsx"

SHEETS = ("全量复核", "HALO标签复核")

# Excel / 口语 → tag_taxonomy.tag_name（当前 qdii_portfolio/fund_tagging.db）
TAG_ALIASES: dict[str, str] = {
    "DATACENTER": "DataCenter",
    "DATACENTRE": "DataCenter",
    "EMERGING MARKETS": "EM",
    "EMERGING_MARKETS": "EM",
    "CONSUMER": "ConsumerDisc",
    "CONSUMER DISCRETIONARY": "ConsumerDisc",
    "CONSUMER STAPLES": "ConsumerStaples",
    "LOW VOL": "LowVol",
    "LOW-VOL": "LowVol",
    "LOW VOL.": "LowVol",
    "GOV TBOND": "GovtBond-US",
    "GOVTBOND-US": "GovtBond-US",
}


def _norm_holding(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s or None


def _split_tag_tokens(text: str) -> list[str]:
    """按逗号、中文逗号、竖线拆分标签串。"""
    text = text.strip()
    if not text or text.lower() == "nan":
        return []
    parts: list[str] = []
    for chunk in re.split(r"\s*[,，]\s*", text):
        for sub in re.split(r"\s*\|\s*", chunk):
            t = sub.strip()
            if t and t.lower() != "nan":
                parts.append(t)
    return parts


def _tags_from_row(row: pd.Series) -> set[str]:
    names: set[str] = set()
    full = row.get("全部标签")
    if full is not None and not (isinstance(full, float) and pd.isna(full)):
        s = str(full).strip()
        if s and s.lower() != "nan":
            for t in _split_tag_tokens(s):
                names.add(t)
            return names
    for col in ("地域", "行业", "主题", "HALO"):
        v = row.get(col)
        if v is None or (isinstance(v, float) and pd.isna(v)):
            continue
        s = str(v).strip()
        if not s or s.lower() == "nan":
            continue
        for t in _split_tag_tokens(s):
            names.add(t)
    return names


def load_name_to_id(conn: sqlite3.Connection) -> dict[str, int]:
    cur = conn.execute(
        "SELECT tag_name, tag_id FROM tag_taxonomy WHERE COALESCE(is_active, 1) = 1"
    )
    return {row[0].upper(): row[1] for row in cur.fetchall()}


def resolve_tag(raw: str, name_to_id: dict[str, int]) -> tuple[int | None, str]:
    key = raw.strip()
    if not key:
        return None, raw
    u = key.upper()
    u = TAG_ALIASES.get(u, u)
    tid = name_to_id.get(u)
    if tid is not None:
        return tid, raw
    # 原样再试一次（大小写）
    tid = name_to_id.get(key.upper())
    return tid, raw


def collect_holdings_tags(xlsx: Path) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for sheet in SHEETS:
        try:
            df = pd.read_excel(xlsx, sheet_name=sheet)
        except ValueError:
            print(f"跳过：未找到工作表 {sheet!r}", file=sys.stderr)
            continue
        need = {"持仓标准化名", "全部标签"}
        if not need.issubset(set(df.columns)):
            missing = need - set(df.columns)
            print(f"跳过 {sheet!r}：缺列 {missing}", file=sys.stderr)
            continue
        for _, row in df.iterrows():
            h = _norm_holding(row.get("持仓标准化名"))
            if not h:
                continue
            tags = _tags_from_row(row)
            if not tags:
                continue
            out.setdefault(h, set()).update(tags)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="从复核表 xlsx 导入 holding_tag_map")
    ap.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX, help="Excel 路径")
    ap.add_argument("--dry-run", action="store_true", help="只打印统计，不写库")
    ap.add_argument(
        "--aggregate",
        action="store_true",
        help="导入成功后自动执行 fund_tagging aggregate",
    )
    args = ap.parse_args()

    db_path = Path(FUND_TAGGING_DB)
    if not db_path.is_file():
        print(f"未找到数据库: {db_path}", file=sys.stderr)
        return 1
    if not args.xlsx.is_file():
        print(f"未找到 Excel: {args.xlsx}", file=sys.stderr)
        return 1

    holding_tags = collect_holdings_tags(args.xlsx)
    if not holding_tags:
        print("没有可导入的数据（检查工作表名是否为 全量复核 / HALO标签复核，且存在标签列）。")
        return 1

    conn = sqlite3.connect(str(db_path))
    try:
        name_to_id = load_name_to_id(conn)
        inserts: list[tuple[str, int, float, str]] = []
        unknown: set[str] = set()
        n_holdings = 0
        for h, raw_names in sorted(holding_tags.items(), key=lambda x: x[0]):
            ids: list[int] = []
            for rn in sorted(raw_names):
                tid, orig = resolve_tag(rn, name_to_id)
                if tid is None:
                    unknown.add(orig)
                else:
                    ids.append(tid)
            ids = sorted(set(ids))
            if not ids:
                continue
            n_holdings += 1
            if args.dry_run:
                continue
            conn.execute("DELETE FROM holding_tag_map WHERE holding_name_std = ?", (h,))
            for tid in ids:
                inserts.append((h, tid, 1.0, "manual"))
        if not args.dry_run and inserts:
            conn.executemany(
                """
                INSERT INTO holding_tag_map (holding_name_std, tag_id, confidence_score, source)
                VALUES (?, ?, ?, ?)
                """,
                inserts,
            )
            conn.commit()
    finally:
        conn.close()

    n_pairs = sum(len(v) for v in holding_tags.values())
    print(
        f"持仓数(有标签行合并后): {len(holding_tags)} | "
        f"原始标签串条数(含重复): {n_pairs}"
    )
    if unknown:
        print(f"未在 tag_taxonomy 中识别的标签 ({len(unknown)} 个，已跳过):", file=sys.stderr)
        for u in sorted(unknown)[:80]:
            print(f"  - {u!r}", file=sys.stderr)
        if len(unknown) > 80:
            print(f"  ... 另有 {len(unknown) - 80} 个", file=sys.stderr)
    if args.dry_run:
        print("[dry-run] 未写入数据库。")
        return 0

    print(f"已更新 {n_holdings} 个持仓，写入 {len(inserts)} 条 holding_tag_map（source=manual）。")

    if args.aggregate:
        cmd = [
            sys.executable,
            "-m",
            "fund_tagging.run",
            "--db",
            str(db_path.resolve()),
            "aggregate",
        ]
        print("运行:", " ".join(cmd))
        r = subprocess.run(cmd, cwd=str(ROOT))
        return r.returncode
    else:
        print("请手动执行基金层聚合，例如:")
        print(f"  py -3 -m fund_tagging.run --db {db_path} aggregate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
