#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 fund_tagging.db 导出：所有股票(equity)+债券(bond) 持仓的当前打标结果，供人工核对是否合适。

用法（仓库根目录）:
  py -3 scripts/export_qdii_holding_tags_excel.py
  py -3 scripts/export_qdii_holding_tags_excel.py --out 输出/自定义.xlsx

默认输出: 输出/qdii_持仓标签_供人工审核.xlsx
  - 「人工审核」: 每标的一行，带空白列「人工核对 / 备注 / 建议增标签 / 建议删标签」
  - 「按持仓汇总」: 标签合并展示
  - 「明细」: 每行一条 持仓×标签
  - 「标签体系」: tag_taxonomy 全表（对照用）
"""

from __future__ import annotations

import argparse
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

DEFAULT_OUT = ROOT / "输出" / "qdii_持仓标签_供人工审核.xlsx"


def load_zh_labels_from_ts(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    line_re = re.compile(
        r'^\s*(?:"([^"]+)"|([A-Za-z][A-Za-z0-9_]*))\s*:\s*"([^"]*)"\s*,?\s*(?://.*)?$'
    )
    for line in text.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("//") or raw.startswith("*"):
            continue
        if raw in ("const ZH_LABELS: Record<string, string> = {", "};"):
            continue
        m = line_re.match(line)
        if m:
            key = m.group(1) if m.group(1) is not None else m.group(2)
            out[key] = m.group(3)
    return out


def zh_label(d: dict[str, str], tag: str | None) -> str:
    if tag is None or (isinstance(tag, float) and pd.isna(tag)):
        return ""
    s = str(tag).strip()
    return d.get(s, s)


DETAIL_SQL = """
WITH hb AS (
  SELECT
    holding_name_std,
    GROUP_CONCAT(DISTINCT holding_type) AS holding_types,
    MAX(as_of_date) AS last_as_of_date
  FROM fund_holding_exposure
  WHERE holding_type IN ('equity', 'bond')
  GROUP BY holding_name_std
)
SELECT
  hb.holding_name_std AS 持仓标准化名,
  hb.holding_types AS 持仓类型_equity_bond,
  hb.last_as_of_date AS 敞口最新日期,
  tt.tag_name AS 标签英文名,
  tt.category AS 标签分类,
  htm.confidence_score AS 置信度,
  htm.source AS 来源,
  htm.tagged_at AS 打标时间
FROM hb
LEFT JOIN holding_tag_map htm ON htm.holding_name_std = hb.holding_name_std
LEFT JOIN tag_taxonomy tt
  ON tt.tag_id = htm.tag_id AND COALESCE(tt.is_active, 1) = 1
ORDER BY hb.holding_name_std, tt.category, tt.tag_name;
"""

EXPOSURE_SQL = """
SELECT
  holding_name_std,
  fund_id,
  fund_name_cn,
  holding_name_raw,
  holding_type,
  as_of_date
FROM fund_holding_exposure
WHERE holding_type IN ('equity', 'bond')
"""

TAXONOMY_SQL = """
SELECT tag_id, tag_name, category, parent_tag_id,
       COALESCE(is_active, 1) AS is_active,
       aliases, description
FROM tag_taxonomy
ORDER BY category, tag_name;
"""


def exposure_context(conn: sqlite3.Connection) -> pd.DataFrame:
    """每标的：示例原始名、涉及基金数、示例基金（最多3只）。"""
    ex = pd.read_sql_query(EXPOSURE_SQL, conn)
    if ex.empty:
        return pd.DataFrame(
            columns=[
                "持仓标准化名",
                "示例原始名",
                "涉及基金数",
                "示例基金",
            ]
        )
    ex["as_of_date"] = pd.to_datetime(ex["as_of_date"], errors="coerce")
    rows: list[dict] = []
    for h, g in ex.groupby("holding_name_std", dropna=False):
        g2 = g.sort_values("as_of_date", ascending=False, na_position="last")
        raw = g2["holding_name_raw"].dropna().astype(str).str.strip()
        sample_raw = raw.iloc[0] if len(raw) else ""
        n_funds = g["fund_id"].nunique()
        names = (
            g["fund_name_cn"]
            .dropna()
            .astype(str)
            .str.strip()
            .replace("", pd.NA)
            .dropna()
            .unique()
        )
        names_sorted = sorted(names, key=lambda x: x)
        sample_funds = " / ".join(names_sorted[:3])
        if len(names_sorted) > 3:
            sample_funds += f" …共{len(names_sorted)}只"
        rows.append(
            {
                "持仓标准化名": h,
                "示例原始名": sample_raw,
                "涉及基金数": int(n_funds),
                "示例基金": sample_funds,
            }
        )
    return pd.DataFrame(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="导出 QD 持仓标签 Excel（供人工审核）")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出 .xlsx 路径")
    args = ap.parse_args()
    db_path = Path(FUND_TAGGING_DB)
    if not db_path.is_file():
        print(f"未找到数据库: {db_path}", file=sys.stderr)
        print("可设置环境变量 FUND_TAGGING_DB 指向 fund_tagging.db", file=sys.stderr)
        return 1

    zh = load_zh_labels_from_ts(TS_LABELS)
    conn = sqlite3.connect(str(db_path))
    try:
        df = pd.read_sql_query(DETAIL_SQL, conn)
        ctx = exposure_context(conn)
        tax = pd.read_sql_query(TAXONOMY_SQL, conn)
    finally:
        conn.close()

    df["标签中文"] = df["标签英文名"].apply(lambda x: zh_label(zh, x))

    summary_rows: list[dict] = []
    for holding, g in df.groupby("持仓标准化名", dropna=False):
        first = g.iloc[0]
        by_cat: dict[str, list[str]] = defaultdict(list)
        tags_en: list[str] = []
        for _, r in g.iterrows():
            en = r["标签英文名"]
            if pd.isna(en) or str(en).strip() == "":
                continue
            en = str(en).strip()
            cat = r["标签分类"]
            cat_s = str(cat) if pd.notna(cat) else "unknown"
            if en not in by_cat[cat_s]:
                by_cat[cat_s].append(en)
            if en not in tags_en:
                tags_en.append(en)
        for k in by_cat:
            by_cat[k].sort()
        parts_zh = []
        parts_en = []
        for cat in sorted(by_cat.keys()):
            ens = by_cat[cat]
            parts_en.append(f"{cat}:[{', '.join(ens)}]")
            zhs = [zh_label(zh, e) for e in ens]
            parts_zh.append(f"{cat}:[{', '.join(zhs)}]")
        summary_rows.append(
            {
                "持仓标准化名": holding,
                "持仓类型_equity_bond": first["持仓类型_equity_bond"],
                "敞口最新日期": first["敞口最新日期"],
                "标签数": len(tags_en),
                "按分类_英文": " | ".join(parts_en),
                "按分类_中文": " | ".join(parts_zh),
                "标签中文_顿号": "、".join(zh_label(zh, t) for t in tags_en),
                "标签英文_逗号": ", ".join(tags_en),
            }
        )
    summary_df = pd.DataFrame(summary_rows).sort_values("持仓标准化名")
    summary_df = summary_df.merge(ctx, on="持仓标准化名", how="left")
    summary_df["示例原始名"] = summary_df["示例原始名"].fillna("")
    summary_df["涉及基金数"] = summary_df["涉及基金数"].fillna(0).astype(int)
    summary_df["示例基金"] = summary_df["示例基金"].fillna("")

    # 人工审核表：核对列留空
    audit_df = summary_df.copy()
    audit_df.insert(0, "序号", range(1, len(audit_df) + 1))
    audit_df = audit_df.rename(
        columns={
            "标签中文_顿号": "当前标签_中文",
            "按分类_中文": "当前标签_按分类中文",
            "按分类_英文": "当前标签_英文_按分类",
        }
    )
    audit_df["人工核对"] = ""
    audit_df["备注"] = ""
    audit_df["建议增标签"] = ""
    audit_df["建议删标签"] = ""
    audit_cols = [
        "序号",
        "持仓标准化名",
        "示例原始名",
        "持仓类型_equity_bond",
        "涉及基金数",
        "示例基金",
        "敞口最新日期",
        "标签数",
        "当前标签_中文",
        "当前标签_按分类中文",
        "当前标签_英文_按分类",
        "人工核对",
        "备注",
        "建议增标签",
        "建议删标签",
    ]
    audit_df = audit_df[[c for c in audit_cols if c in audit_df.columns]]

    # 标签体系加中文列
    tax = tax.copy()
    tax["标签中文"] = tax["tag_name"].apply(lambda x: zh_label(zh, x))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
        audit_df.to_excel(writer, sheet_name="人工审核", index=False)
        summary_df.to_excel(writer, sheet_name="按持仓汇总", index=False)
        df.to_excel(writer, sheet_name="明细", index=False)
        tax.to_excel(writer, sheet_name="标签体系", index=False)

    try:
        print(
            f"OK: {len(audit_df)} holdings, detail {len(df)} rows -> {args.out}",
            file=sys.stdout,
        )
    except UnicodeEncodeError:
        print(f"OK: {len(audit_df)} rows -> {args.out}", file=sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
