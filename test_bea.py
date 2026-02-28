# -*- coding: utf-8 -*-
"""
东亚联丰 BEA 解析自测脚本：第 2 页分块提取，打印地域/行业/持仓/债券指标。
"""
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from parsers.bea_parser import (
    extract_blocks,
    parse_distribution_block,
    parse_top_holdings_block,
    parse_bond_summary_block,
)

ONEPAGE = Path(__file__).resolve().parent / "onepage"
PDF_PATHS = list(ONEPAGE.glob("东亚联丰*.pdf"))
if not PDF_PATHS:
    PDF_PATHS = [
        Path(r"D:\portoflio for mrf\onepage\东亚联丰环球股票基金每月基金报告（2026年1月）.pdf"),
        Path(r"D:\portoflio for mrf\onepage\东亚联丰亚洲债券及货币基金每月基金报告（2026年1月）.pdf"),
    ]
PDF_PATHS = [p for p in PDF_PATHS if p.exists()]

for path in PDF_PATHS:
    print(f"\n{'='*50}\n正在测试: {path.name}")
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages) < 2:
                print("  页数不足，跳过")
                continue
            page = pdf.pages[1]
            blocks = extract_blocks(page)

            markets = parse_distribution_block(blocks.get("upper_left", ""))
            sectors = parse_distribution_block(blocks.get("upper_right", ""))
            holdings = parse_top_holdings_block(blocks.get("lower_left", ""))
            bonds = parse_bond_summary_block(blocks.get("lower_right", ""))

            print(f"  地域分布 keys 数量: {len(markets)} -> {list(markets.keys())[:5]}...")
            print(f"  行业分布 keys 数量: {len(sectors)} -> {list(sectors.keys())[:5]}...")
            print(f"  主要投资 前 3 条: {[{'name': h.name, 'market': h.market, 'weight': h.weight} for h in holdings[:3]]}")
            print(f"  债券指标: {bonds}")

            for k, v in blocks.items():
                if not (v or "").strip():
                    print(f"  警告: 区块 {k} 提取为空")
    except Exception as e:
        print(f"  解析失败: {e}")

print("\n完成")
