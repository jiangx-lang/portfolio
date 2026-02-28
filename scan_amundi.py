# -*- coding: utf-8 -*-
"""仅扫描东方汇理 PDF 并输出抽取结果。"""

import json
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import get_parser_for_file, parse_fund_pdf

ONEPAGE = Path(__file__).resolve().parent / "onepage"
if not ONEPAGE.exists():
    ONEPAGE = Path(r"D:\portoflio for mrf\onepage")

def main():
    pdfs = [
        p for p in sorted(ONEPAGE.glob("*.pdf"))
        if get_parser_for_file(p) and ("东方" in p.stem or "amundi" in p.stem.lower())
    ]
    print(f"共 {len(pdfs)} 个东方汇理 PDF")
    print("=" * 60)
    for p in pdfs:
        try:
            data = parse_fund_pdf(p)
            print(f"\n【{data.fund_name}】 {p.name}\n")
            print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
            print("\n" + "-" * 60)
        except Exception as e:
            print(f"[跳过] {p.name}: {e}\n" + "-" * 60)

if __name__ == "__main__":
    main()
