"""
data/fund_meta_builder.py
从 top_holdings_detail.csv 提取基金元数据 → data/fund_meta.csv

在项目根目录运行一次：
    python -m data.fund_meta_builder
"""

import csv
from pathlib import Path

# 供 theme_search 等读取基金名称/代码/风险
def _load_fund_meta() -> dict[int, dict]:
    """Load fund name/code/risk from data/fund_meta.csv. Returns dict[fund_id, {name, code, risk}]."""
    meta_path = Path(__file__).resolve().parent / "fund_meta.csv"
    if not meta_path.exists():
        return {}
    result = {}
    with meta_path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                fid = int(row["fund_id"])
                result[fid] = {
                    "name": row.get("fund_name_cn", ""),
                    "code": row.get("sc_product_codes", ""),
                    "risk": row.get("sc_risk_rating", ""),
                }
            except (ValueError, KeyError):
                pass
    return result


def build(
    detail_csv: str = "top_holdings_detail.csv",
    output_csv: str = "data/fund_meta.csv",
) -> int:
    src = Path(detail_csv)
    if not src.exists():
        raise FileNotFoundError(f"Not found: {src}")

    meta: dict[int, dict] = {}
    with src.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                fid = int(row["fund_id"])
            except (ValueError, KeyError):
                continue
            if fid not in meta:
                meta[fid] = {
                    "fund_id":          fid,
                    "fund_name_cn":     row.get("fund_name_cn", ""),
                    "sc_product_codes": row.get("sc_product_codes", ""),
                    "sc_risk_rating":   "",   # fill from sc_funds.db if available
                }

    out = Path(output_csv)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f, fieldnames=["fund_id", "fund_name_cn", "sc_product_codes", "sc_risk_rating"]
        )
        writer.writeheader()
        writer.writerows(sorted(meta.values(), key=lambda x: x["fund_id"]))

    print(f"Written {len(meta)} funds → {out}")
    return len(meta)


if __name__ == "__main__":
    build()
