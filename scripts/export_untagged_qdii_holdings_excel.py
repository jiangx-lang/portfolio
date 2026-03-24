#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出 fund_tagging.db 中：仍然“完全没有标签”的 QDII（equity/bond）持仓，供人工补标签。
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import FUND_TAGGING_DB  # noqa: E402


DEFAULT_OUT = ROOT / "输出" / "qdii_未打标签持仓清单.xlsx"


def main() -> int:
    ap = argparse.ArgumentParser(description="Export untagged QDII holdings to Excel")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出 .xlsx 路径")
    ap.add_argument("--db", type=Path, default=None, help="指定 fund_tagging.db（可选）")
    args = ap.parse_args()

    db_path = args.db if args.db is not None else Path(FUND_TAGGING_DB)
    if not db_path.is_file():
        print(f"未找到数据库: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        df = pd.read_sql_query(
            """
            WITH base AS (
              SELECT
                hte.holding_name_std,
                hte.holding_type,
                hte.holding_name_raw,
                hte.fund_name_cn,
                hte.as_of_date
              FROM fund_holding_exposure hte
              WHERE hte.holding_type IN ('equity','bond')
            ),
            untagged AS (
              SELECT b.*
              FROM base b
              WHERE NOT EXISTS (
                SELECT 1 FROM holding_tag_map htm
                WHERE htm.holding_name_std = b.holding_name_std
              )
            )
            SELECT
              holding_name_std,
              GROUP_CONCAT(DISTINCT holding_type) AS holding_types,
              MAX(as_of_date) AS last_as_of_date,
              COUNT(*) AS exposure_rows,
              MAX(holding_name_raw) AS example_holding_name_raw,
              GROUP_CONCAT(DISTINCT fund_name_cn) AS sample_funds_cn
            FROM untagged
            GROUP BY holding_name_std
            ORDER BY holding_name_std;
            """,
            conn,
        )
    finally:
        conn.close()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="未打标签清单", index=False)

    print(f"已导出未打标签持仓：{len(df)} 条 -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

