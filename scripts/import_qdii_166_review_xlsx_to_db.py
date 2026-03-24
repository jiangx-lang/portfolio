#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 `输出/qdii_166真实名_复核表.xlsx`（或同结构的复核表）的手工复核标签导入 fund_tagging.db。

假设 Excel 工作表：
  - sheet：`166个待打标持仓`
  - 列：
    - 持仓标准化名
    - 人工确认（✓）
    - 标签串列：可能是 `全部标签` 或 `全部标签(逗号分隔)`

导入策略：
  - 对每个持仓：DELETE 其在 holding_tag_map 的全部标签记录，然后按 Excel 写入
    （source=manual, confidence=1.0）
  - 之后运行 fund_tagging aggregate 重算 fund_tag_map
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Import qdii 166 review xlsx to holding_tag_map")
    ap.add_argument(
        "--xlsx",
        type=Path,
        default=ROOT / "输出" / "qdii_166真实名_复核表.xlsx",
        help="复核表 xlsx 路径（支持：全部标签 / 全部标签(逗号分隔) 两种列名）",
    )
    ap.add_argument(
        "--db",
        type=Path,
        default=None,
        help="fund_tagging.db 路径；不传则使用 config.FUND_TAGGING_DB",
    )
    ap.add_argument(
        "--no-aggregate",
        action="store_true",
        help="不运行 aggregate（仅写入 holding_tag_map）",
    )
    return ap.parse_args()


def load_tag_index(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute(
        "SELECT tag_id, tag_name FROM tag_taxonomy WHERE COALESCE(is_active,1)=1"
    ).fetchall()
    return {str(r[1]).strip().upper(): int(r[0]) for r in rows}


TAG_ALIASES: dict[str, str] = {
    "DATACENTER": "Datacenter",
    "DATACENTRE": "DataCenter",
    "CONSUMER": "ConsumerDisc",
    "EMERGING MARKETS": "EM",
    "LOW VOL": "LowVol",
    "LOW-VOL": "LowVol",
}


def split_tags(s: str) -> list[str]:
    if not s:
        return []
    # 逗号/中文逗号分隔
    parts = [x.strip() for x in re.split(r"[,\uFF0C]", str(s)) if x and str(x).strip()]
    # 去掉全角空格/零宽不影响这里，但这里先统一
    out: list[str] = []
    for p in parts:
        # 去掉可能出现的空白
        p = p.strip()
        if not p or p.lower() == "nan":
            continue
        out.append(p)
    return out


def main() -> int:
    args = parse_args()
    if not args.xlsx.is_file():
        print(f"未找到 xlsx: {args.xlsx}", file=sys.stderr)
        return 1

    if args.db is None:
        from config import FUND_TAGGING_DB

        db_path = Path(FUND_TAGGING_DB)
    else:
        db_path = args.db

    if not db_path.is_file():
        print(f"未找到数据库: {db_path}", file=sys.stderr)
        return 1

    import pandas as pd

    df = pd.read_excel(args.xlsx, sheet_name="166个待打标持仓")
    holding_col: str | None = None
    if "持仓标准化名" in df.columns:
        holding_col = "持仓标准化名"
    elif "holding_name_std" in df.columns:
        holding_col = "holding_name_std"

    if not holding_col or "人工确认" not in df.columns:
        missing = set()
        if not holding_col:
            missing.add("持仓标准化名(或 holding_name_std)")
        if "人工确认" not in df.columns:
            missing.add("人工确认")
        print(f"缺少列: {missing}", file=sys.stderr)
        return 1

    tag_col: str | None = None
    if "全部标签" in df.columns:
        tag_col = "全部标签"
    elif "全部标签(逗号分隔)" in df.columns:
        tag_col = "全部标签(逗号分隔)"

    if not tag_col:
        print("缺少标签列：需要 `全部标签` 或 `全部标签(逗号分隔)`", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path))
    try:
        tag_index = load_tag_index(conn)
        unknown: set[str] = set()
        updates: list[tuple[str, int]] = []

        # 先把所有 holding->tag_id 解析出来（更好统计 unknown）
        holding_to_tagids: dict[str, list[int]] = {}
        for _, r in df.iterrows():
            holding = r.get(holding_col)
            if pd.isna(holding):
                continue
            holding_std = str(holding).strip()
            if not holding_std:
                continue
            ok = r.get("人工确认")
            if pd.isna(ok) or str(ok).strip() not in ("✓", "√", "1", "是", "True", "true"):
                continue
            tags_str = r.get(tag_col)
            tag_tokens = split_tags(tags_str if pd.notna(tags_str) else "")
            if not tag_tokens:
                continue

            tag_ids: set[int] = set()
            for t in tag_tokens:
                tt = TAG_ALIASES.get(str(t).strip().upper(), t)
                tid = tag_index.get(str(tt).strip().upper())
                if tid is None:
                    unknown.add(str(t).strip())
                else:
                    tag_ids.add(tid)

            if tag_ids:
                holding_to_tagids[holding_std] = sorted(tag_ids)

        if not holding_to_tagids:
            print("没有解析到任何可导入的标签数据。")
            return 1

        # 覆盖写入
        inserts: list[tuple[str, int, float, str]] = []
        for holding_std, tag_ids in holding_to_tagids.items():
            conn.execute("DELETE FROM holding_tag_map WHERE holding_name_std = ?", (holding_std,))
            for tid in tag_ids:
                inserts.append((holding_std, tid, 1.0, "manual"))

        conn.executemany(
            """
            INSERT INTO holding_tag_map (holding_name_std, tag_id, confidence_score, source)
            VALUES (?, ?, ?, ?)
            """,
            inserts,
        )
        conn.commit()

        print(
            f"导入完成：持仓 {len(holding_to_tagids)} 个，写入 holding_tag_map {len(inserts)} 条。"
        )
        if unknown:
            print(f"未识别标签（已跳过）共 {len(unknown)} 个，示例：{sorted(unknown)[:30]}", file=sys.stderr)
    finally:
        conn.close()

    if not args.no_aggregate:
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

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

