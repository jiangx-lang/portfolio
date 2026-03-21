# debug_pdf_tables.py
import sys
import pdfplumber

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

pdfs = [
    'onepage/施罗德亚洲高息股债.pdf',
    'onepage/摩根国际债.pdf',
    'onepage/摩根亚洲总收益.pdf',
]

for pdf_path in pdfs:
    print(f"\n{'='*60}")
    print(f"PDF: {pdf_path}")
    print('='*60)
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if tables:
                    print(f"\n--- Page {page_num+1}: {len(tables)} 个表格 ---")
                    for t_idx, table in enumerate(tables):
                        print(f"\n表格 {t_idx+1} ({len(table)}行):")
                        for row in table[:12]:  # 前12行，便于看到表头+数据
                            print(f"  {row}")
    except Exception as e:
        print(f"ERR: {e}")
