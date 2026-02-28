# -*- coding: utf-8 -*-
"""扫描东亚联丰 PDF，打印抽取信息。"""
import json
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import get_parser_for_file, parse_fund_pdf

ONEPAGE_DIR = Path(__file__).resolve().parent / "onepage"
pdf_files = list(ONEPAGE_DIR.glob("*.pdf"))
bea_pdfs = [p for p in pdf_files if get_parser_for_file(p) is not None and ("东亚" in p.stem or "联丰" in p.stem)]

if not bea_pdfs:
    print("未找到东亚/联丰 PDF")
    sys.exit(1)

for path in sorted(bea_pdfs, key=lambda p: p.name):
    print("=" * 60)
    print("【" + path.stem + "】", path.name)
    print()
    data = parse_fund_pdf(path)
    print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
    print()
