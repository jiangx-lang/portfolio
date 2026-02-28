# -*- coding: utf-8 -*-
"""仅扫描惠理 PDF 并输出抽取结果与验收统计。"""

import json
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from parsers.valuepartners_parser import ValuePartnersFundParser

ONEPAGE = Path(__file__).resolve().parent / "onepage"
if not ONEPAGE.exists():
    ONEPAGE = Path(r"D:\portoflio for mrf\onepage")

def main():
    pdfs = [
        p for p in sorted(ONEPAGE.glob("*.pdf"))
        if ("惠理" in p.stem or "value" in p.stem.lower() or "valuepartners" in p.stem.lower())
    ]
    parser = ValuePartnersFundParser()

    print(f"共 {len(pdfs)} 个惠理 PDF")
    print("=" * 60)

    for p in pdfs:
        try:
            data = parser.parse(p)
        except Exception as e:
            print(f"[跳过] {p.name}: {e}\n" + "-" * 60)
            continue

        n_top = len(data.top_10_holdings)
        n_market = len(data.market_allocation)
        n_sector = len(data.sector_allocation)
        sector_has_digit = any(k.isdigit() or (k.strip() and k.strip().isdigit()) for k in data.sector_allocation)

        print(f"【条数统计】 top_10_holdings={n_top}  market_allocation={n_market}  sector_allocation={n_sector}  sector含纯数字key={sector_has_digit}")

        ok = True
        if n_top != 10:
            print(f"  ❌ top_10_holdings 应为 10，当前 {n_top}")
            ok = False
        if n_market < 8:
            print(f"  ❌ market_allocation 应 >= 8，当前 {n_market}")
            ok = False
        if n_sector < 8:
            print(f"  ❌ sector_allocation 应 >= 8，当前 {n_sector}")
            ok = False
        if sector_has_digit:
            print("  ❌ sector_allocation 不得含纯数字 key")
            ok = False
        if ok:
            print("  ✅ 验收通过")

        print(f"\n【{data.fund_name}】 {p.name}\n")
        print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
        print("\n" + "-" * 60)


if __name__ == "__main__":
    main()
