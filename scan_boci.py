# -*- coding: utf-8 -*-
"""扫描中银(BOCI) PDF，打印抽取信息。"""
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
pdfs = [
    p for p in ONEPAGE.glob("*.pdf")
    if get_parser_for_file(p) is not None and any(k in p.stem for k in ("中银", "中銀", "boci"))
]
pdfs = sorted(pdfs, key=lambda p: p.name)

if not pdfs:
    print("未找到中银(BOCI) PDF")
    sys.exit(1)

print(f"共 {len(pdfs)} 个中银 PDF")
print("=" * 60)
for path in pdfs:
    print("【" + path.stem + "】", path.name)
    print()
    try:
        data = parse_fund_pdf(path)
        print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
    except Exception as e:
        print("解析失败:", e)
    print()
    print("-" * 60)
