# -*- coding: utf-8 -*-
"""扫描所有可解析 PDF，详细展示抽取信息。"""
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
pdfs = sorted(
    [p for p in ONEPAGE.glob("*.pdf") if get_parser_for_file(p) is not None],
    key=lambda p: p.name,
)

print("=" * 70)
print("全部基金抽取信息（共 %d 个 PDF）" % len(pdfs))
print("=" * 70)

for path in pdfs:
    try:
        data = parse_fund_pdf(path)
    except Exception as e:
        print("\n【%s】 解析失败: %s\n" % (path.stem, e))
        print("-" * 70)
        continue

    print("\n【%s】 %s" % (data.fund_name, path.name))
    print()

    # 投资组合分析 (波幅等)
    if data.portfolio_analysis:
        print("  投资组合分析 (portfolio_analysis):")
        for k, v in data.portfolio_analysis.items():
            if isinstance(v, dict):
                print("    %s: %s" % (k, v))
            else:
                print("    %s: %s" % (k, v))
        print()
    else:
        print("  投资组合分析: (无)")
        print()

    # 十大持仓
    print("  十大持仓 (top_10_holdings) 共 %d 条:" % len(data.top_10_holdings))
    for i, h in enumerate(data.top_10_holdings, 1):
        sector_str = " | %s" % h.sector if h.sector else ""
        print("    %2d. %s%s  %.2f%%" % (i, h.name, sector_str, h.weight))
    if not data.top_10_holdings:
        print("    (无)")
    print()

    # 十大债券持仓
    if data.top_10_bond_holdings:
        print("  十大债券持仓 (top_10_bond_holdings) 共 %d 条:" % len(data.top_10_bond_holdings))
        for i, h in enumerate(data.top_10_bond_holdings, 1):
            print("    %2d. %s  %.2f%%" % (i, h.name, h.weight))
        print()
    else:
        print("  十大债券持仓: (无)")
        print()

    # 地区分布
    print("  地区分布 (market_allocation) 共 %d 条:" % len(data.market_allocation))
    if data.market_allocation:
        for label, w in sorted(data.market_allocation.items(), key=lambda x: -x[1]):
            print("    %s  %.2f%%" % (label, w))
    else:
        print("    (无)")
    print()

    # 行业分布
    print("  行业分布 (sector_allocation) 共 %d 条:" % len(data.sector_allocation))
    if data.sector_allocation:
        for label, w in sorted(data.sector_allocation.items(), key=lambda x: -x[1]):
            print("    %s  %.2f%%" % (label, w))
    else:
        print("    (无)")
    print()

    if data.bond_metrics:
        print("  债券指标 (bond_metrics): %s" % data.bond_metrics)
        print()
    if data.asset_allocation:
        print("  资产配置 (asset_allocation): %s" % data.asset_allocation)
        print()

    print("-" * 70)

print("\n完成。")
