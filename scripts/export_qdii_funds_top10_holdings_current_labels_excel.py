#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出：QD 基金（最新 as_of_date）每只取 Top 10 持仓（equity/bond），
并附上“当前 holding_tag_map 的标签”（含分类维度）与基金层 Top 标签。

输出 Excel（便于你人工优化标签规则）：每行=1个基金+1个持仓（rank）。
"""

from __future__ import annotations

import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import FUND_TAGGING_DB  # noqa: E402

TS_LABELS = ROOT / "mf-holdings-dashboard" / "src" / "data" / "qdiiTagLabelsZh.ts"

DEFAULT_OUT = ROOT / "输出" / "qdii_funds_top10_holdings_current_labels.xlsx"


def load_zh_labels_from_ts(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    line_re = re.compile(
        r'^\s*(?:(?:"([^"]+)")|([A-Za-z][A-Za-z0-9_]*))\s*:\s*"([^"]*)"\s*,?\s*(?://.*)?$'
    )
    for line in text.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("//") or raw.startswith("*"):
            continue
        # skip wrapper lines
        if raw.startswith("const ZH_LABELS") or raw.startswith("export function"):
            continue
        m = line_re.match(line)
        if m:
            key = m.group(1) if m.group(1) is not None else m.group(2)
            out[key] = m.group(3)
    return out


def zh_label(zh_map: dict[str, str], tag: str | None) -> str:
    if tag is None:
        return ""
    s = str(tag).strip()
    if not s:
        return ""
    return zh_map.get(s, s)


def main() -> int:
    out = DEFAULT_OUT
    db_path = Path(FUND_TAGGING_DB)
    if not db_path.is_file():
        print(f"未找到数据库: {db_path}", file=sys.stderr)
        return 1

    zh_map = load_zh_labels_from_ts(TS_LABELS)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        # 取最新 as_of_date 下的 top 10 持仓
        top_holdings_sql = """
        WITH latest AS (
          SELECT fund_id, MAX(as_of_date) AS latest_date
          FROM fund_holding_exposure
          WHERE holding_type IN ('equity','bond')
          GROUP BY fund_id
        ),
        ranked AS (
          SELECT
            fhe.fund_id,
            fhe.fund_name_cn,
            fhe.as_of_date,
            fhe.rank,
            fhe.holding_name_std,
            fhe.holding_name_raw,
            fhe.holding_type,
            fhe.weight_pct,
            ROW_NUMBER() OVER (PARTITION BY fhe.fund_id ORDER BY fhe.rank) AS rn
          FROM fund_holding_exposure fhe
          JOIN latest l
            ON l.fund_id = fhe.fund_id
           AND l.latest_date = fhe.as_of_date
          WHERE fhe.holding_type IN ('equity','bond')
        )
        SELECT
          r.fund_id,
          r.fund_name_cn,
          r.as_of_date,
          r.rank AS holding_rank,
          r.holding_name_std,
          r.holding_name_raw,
          r.holding_type,
          r.weight_pct,
          tt.category,
          tt.tag_name,
          COALESCE(tt.is_active, 1) AS tag_is_active
        FROM ranked r
        LEFT JOIN holding_tag_map htm
          ON htm.holding_name_std = r.holding_name_std
        LEFT JOIN tag_taxonomy tt
          ON tt.tag_id = htm.tag_id
        WHERE r.rn <= 10
        ORDER BY r.fund_id, r.rn, tt.category, tt.tag_name;
        """

        rows = conn.execute(top_holdings_sql).fetchall()

        if not rows:
            print("查询到空数据。", file=sys.stderr)
            return 1

        # fund top tags（每基金取前 5）
        fund_ids = sorted({int(r["fund_id"]) for r in rows})
        placeholders = ",".join("?" for _ in fund_ids)
        fund_top_tags_sql = f"""
        WITH ranked_tags AS (
          SELECT
            ftm.fund_id,
            tt.category,
            tt.tag_name,
            ftm.aggregated_score,
            ROW_NUMBER() OVER (PARTITION BY ftm.fund_id ORDER BY ftm.aggregated_score DESC) AS rn
          FROM fund_tag_map ftm
          JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
          WHERE COALESCE(tt.is_active, 1) = 1
            AND ftm.fund_id IN ({placeholders})
        )
        SELECT fund_id, category, tag_name, aggregated_score
        FROM ranked_tags
        WHERE rn <= 5
        ORDER BY fund_id, rn;
        """
        fund_top = defaultdict(list)
        for r in conn.execute(fund_top_tags_sql, fund_ids).fetchall():
            fid = int(r["fund_id"])
            tag_en = str(r["tag_name"])
            cat = str(r["category"])
            fund_top[fid].append((cat, tag_en, float(r["aggregated_score"])))

        # 汇总为每行：fund+holding
        key_fields = [
            "fund_id",
            "fund_name_cn",
            "as_of_date",
            "holding_rank",
            "holding_name_std",
            "holding_name_raw",
            "holding_type",
            "weight_pct",
        ]

        grouped: dict[tuple, dict] = {}
        for r in rows:
            key = tuple(r[k] for k in key_fields)
            if key not in grouped:
                fid = int(r["fund_id"])
                grouped[key] = {
                    "fund_id": fid,
                    "fund_name_cn": r["fund_name_cn"],
                    "as_of_date": r["as_of_date"],
                    "holding_rank": r["holding_rank"],
                    "holding_name_std": r["holding_name_std"],
                    "holding_name_raw": r["holding_name_raw"],
                    "holding_type": r["holding_type"],
                    "weight_pct": r["weight_pct"],
                    "region_tags": [],
                    "sector_tags": [],
                    "theme_tags": [],
                    "style_tags": [],
                    "custom_tags": [],
                    "all_tags_en": [],
                }

            cat = r["category"]
            tag = r["tag_name"]
            if cat is None or tag is None:
                continue
            if r["tag_is_active"] != 1:
                continue
            cat_s = str(cat)
            tag_s = str(tag)
            if tag_s not in grouped[key]["all_tags_en"]:
                grouped[key]["all_tags_en"].append(tag_s)

            if cat_s == "region":
                grouped[key]["region_tags"].append(tag_s)
            elif cat_s == "sector":
                grouped[key]["sector_tags"].append(tag_s)
            elif cat_s == "theme":
                grouped[key]["theme_tags"].append(tag_s)
            elif cat_s == "style":
                grouped[key]["style_tags"].append(tag_s)
            elif cat_s == "custom":
                grouped[key]["custom_tags"].append(tag_s)

        out_rows: list[dict] = []
        for _k, v in grouped.items():
            fid = int(v["fund_id"])
            top_tags = fund_top.get(fid, [])

            fund_top_en = " | ".join([t[1] for t in top_tags])
            fund_top_zh = " | ".join([zh_label(zh_map, t[1]) for t in top_tags])

            def uniq_sorted(xs: list[str]) -> str:
                xs2 = sorted(set(xs))
                return ", ".join(xs2)

            all_tags_en = ", ".join(sorted(set(v["all_tags_en"])))
            all_tags_zh = ", ".join([zh_label(zh_map, t) for t in sorted(set(v["all_tags_en"]))])

            out_rows.append(
                {
                    "fund_id": v["fund_id"],
                    "fund_name_cn": v["fund_name_cn"],
                    "as_of_date": v["as_of_date"],
                    "holding_rank": v["holding_rank"],
                    "holding_name_std": v["holding_name_std"],
                    "holding_name_raw": v["holding_name_raw"],
                    "holding_type": v["holding_type"],
                    "weight_pct": v["weight_pct"],
                    "fund_top_tags_en": fund_top_en,
                    "fund_top_tags_zh": fund_top_zh,
                    "region_tags_en": uniq_sorted(v["region_tags"]),
                    "sector_tags_en": uniq_sorted(v["sector_tags"]),
                    "theme_tags_en": uniq_sorted(v["theme_tags"]),
                    "style_tags_en": uniq_sorted(v["style_tags"]),
                    "custom_tags_en": uniq_sorted(v["custom_tags"]),
                    "holding_all_tags_en": all_tags_en,
                    "holding_all_tags_zh": all_tags_zh,
                }
            )

        df = pd.DataFrame(out_rows).sort_values(["fund_id", "holding_rank"])

        out.parent.mkdir(parents=True, exist_ok=True)
        with pd.ExcelWriter(out, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="基金Top10持仓+当前标签", index=False)

        print(f"已导出: {out}（行数 {len(df)}）")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

