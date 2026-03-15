"""
导出并统计数据库内所有十大重仓股/重仓债券，生成明细与汇总文件。
用法: py export_top_holdings.py [--db ./sc_funds.db]
"""
import sqlite3
import csv
import argparse
from pathlib import Path
from collections import defaultdict


def main():
    ap = argparse.ArgumentParser(description="导出十大重仓明细与汇总")
    ap.add_argument("--db", default="./sc_funds.db", help="数据库路径")
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ 数据库不存在: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 1) 明细：所有持仓记录，带基金信息
    rows = conn.execute("""
        SELECT
            f.id AS fund_id,
            f.fund_name_cn,
            f.source_file,
            f.sc_product_codes,
            h.as_of_date,
            h.rank,
            h.holding_name,
            h.holding_type,
            h.weight_pct
        FROM top_holdings h
        JOIN funds f ON f.id = h.fund_id
        WHERE f.status = 1
        ORDER BY f.fund_name_cn, h.rank
    """).fetchall()

    detail_path = Path(args.db).parent / "top_holdings_detail.csv"
    detail_fields = [
        "fund_id", "fund_name_cn", "source_file", "sc_product_codes",
        "as_of_date", "rank", "holding_name", "holding_type", "weight_pct"
    ]
    with open(detail_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=detail_fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in detail_fields})
    print(f"  ✅ 明细已导出: {detail_path}  ({len(rows)} 条)")

    # 2) 汇总：按 持仓名称+类型 统计「被多少只基金持有」
    #    同一基金同 as_of_date 下去重（同一基金只算一次）
    fund_holding_pairs = set()
    holding_info = defaultdict(lambda: {"type": None, "fund_ids": set(), "total_weight": 0.0})
    for r in rows:
        key = (r["holding_name"].strip(), r["holding_type"] or "")
        fund_holding_pairs.add((r["fund_id"], r["as_of_date"], key))
        holding_info[key]["type"] = r["holding_type"] or ""
        holding_info[key]["fund_ids"].add(r["fund_id"])
        holding_info[key]["total_weight"] += (r["weight_pct"] or 0)

    summary_path = Path(args.db).parent / "top_holdings_summary.csv"
    summary_rows = []
    for (name, type_key), info in holding_info.items():
        summary_rows.append({
            "holding_name": name,
            "holding_type": info["type"] or "equity",
            "num_funds": len(info["fund_ids"]),
            "total_weight_pct": round(info["total_weight"], 2),
        })
    summary_rows.sort(key=lambda x: (-x["num_funds"], -x["total_weight_pct"], x["holding_name"]))

    with open(summary_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["holding_name", "holding_type", "num_funds", "total_weight_pct"])
        w.writeheader()
        w.writerows(summary_rows)
    print(f"  ✅ 汇总已导出: {summary_path}  ({len(summary_rows)} 个标的)")

    # 3) 按类型简要统计
    by_type = defaultdict(int)
    for r in rows:
        t = (r["holding_type"] or "equity").strip().lower()
        if not t:
            t = "equity"
        by_type[t] += 1
    print("\n  按类型条数: " + ", ".join(f"{k}={v}" for k, v in sorted(by_type.items())))

    conn.close()
    print("\n完成.")


if __name__ == "__main__":
    main()
