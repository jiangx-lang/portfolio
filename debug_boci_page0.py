# -*- coding: utf-8 -*-
import sys
if sys.platform == "win32":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except: pass
import pdfplumber
from pathlib import Path
pdfs = [p for p in Path("onepage").glob("*.pdf") if "中银" in p.stem or "中銀" in p.stem or "boci" in p.stem.lower()]
if not pdfs:
    print("No BOCI PDF in onepage")
    sys.exit(0)
for path in sorted(pdfs, key=lambda p: p.name):
        print("=== ", path.name, " ===")
        with pdfplumber.open(path) as pdf:
            for pi in range(min(2, len(pdf.pages))):
                p = pdf.pages[pi]
                t = (p.extract_text(layout=True) or p.extract_text() or "")
                has_sector = "行业" in t or "行業" in t
                has_region = "地区" in t or "地區" in t
                has_hold = "十大" in t or "比重" in t
                has_vol = "标准偏差" in t or "標準偏差" in t
                print("  page[%d]: sector=%s region=%s hold=%s vol=%s" % (pi, has_sector, has_region, has_hold, has_vol))
                for line in t.splitlines():
                    if any(k in line for k in ["行业", "地區", "地区", "十大", "比重", "标准", "北美洲", "净流动", "投资配置"]):
                        print("    ", line[:95])
        print()
