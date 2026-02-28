# -*- coding: utf-8 -*-
"""单次扫描百达 PDF，打印抽取信息。"""
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
pictet_pdfs = [p for p in pdf_files if get_parser_for_file(p) is not None and ("百达" in p.name or "pictet" in p.name.lower())]

if not pictet_pdfs:
    print("未找到百达 PDF")
    sys.exit(1)

path = sorted(pictet_pdfs, key=lambda p: p.name)[0]
print(f"扫描文件: {path.name}\n")
data = parse_fund_pdf(path)
print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
