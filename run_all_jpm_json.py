# -*- coding: utf-8 -*-
"""临时脚本：解析摩根全部 PDF 并输出完整抽取信息（JSON）。"""
import json
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import parse_fund_pdf

def main():
    project_root = Path(__file__).resolve().parent
    onepage_dir = project_root / "onepage"
    pdfs = list(onepage_dir.glob("*.pdf"))
    jpm_pdfs = sorted([p for p in pdfs if "摩根" in p.stem or "jpm" in p.stem.lower()])

    print("摩根产品 - 全部抽取信息（完整 JSON）")
    print()
    for pdf_path in jpm_pdfs:
        data = parse_fund_pdf(pdf_path)
        print("=== " + data.fund_name + " ===")
        print(json.dumps(data.model_dump(), ensure_ascii=False, indent=2))
        print()

if __name__ == "__main__":
    main()
