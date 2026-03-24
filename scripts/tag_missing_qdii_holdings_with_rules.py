#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
只给“尚未在 holding_tag_map 里出现任何标签”的股票/债券持仓补标签（rules）。

目的：
  - 避免对已经存在于 holding_tag_map 的（手工/复核）标签记录进行覆盖。
  - 提升持仓整体覆盖率。

用法（仓库根目录）：
  py -3 scripts/tag_missing_qdii_holdings_with_rules.py
  py -3 scripts/tag_missing_qdii_holdings_with_rules.py --db D:\\xxx\\fund_tagging.db
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Tag missing QDII holdings with rules only")
    ap.add_argument(
        "--db",
        type=Path,
        default=None,
        help="SQLite fund_tagging.db 路径；不传则使用 config.FUND_TAGGING_DB",
    )
    return ap.parse_args()


def main() -> int:
    args = parse_args()

    # configure DB before any get_conn() usage
    if args.db is not None:
        from fund_tagging import db as db_mod

        db_mod.configure(args.db)
        db_mod.init_schema()
    else:
        from config import FUND_TAGGING_DB
        from fund_tagging import db as db_mod

        db_mod.configure(Path(FUND_TAGGING_DB))
        db_mod.init_schema()

    from fund_tagging.db import get_conn

    conn = get_conn()
    try:
        missing = [
            r[0]
            for r in conn.execute(
                """
                SELECT DISTINCT hte.holding_name_std
                FROM fund_holding_exposure hte
                WHERE hte.holding_type IN ('equity','bond')
                  AND NOT EXISTS (
                    SELECT 1
                    FROM holding_tag_map htm
                    WHERE htm.holding_name_std = hte.holding_name_std
                  )
                ORDER BY hte.holding_name_std
                """
            ).fetchall()
        ]
    finally:
        conn.close()

    if not missing:
        print("没有缺失标签的持仓；holding_tag_map 已覆盖全部 equity/bond 持仓。")
        return 0

    from fund_tagging.holding_tagger import run_tagger

    print(f"缺失标签持仓数：{len(missing)}。开始用 rules 补齐…")
    n = run_tagger(missing, use_rules=True, use_llm=False, manual_overrides=None)
    print(f"规则打标产生/更新 holding_tag_map 条数：{n}（按 pairs 计）。")

    from fund_tagging.aggregation import recalculate_all_funds

    total = recalculate_all_funds()
    print(f"aggregate 完成：fund_tag_map rows = {total}。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

