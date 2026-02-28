# -*- coding: utf-8 -*-
"""
最终组装与试运行 (The Grand Finale)
将需要投入配置的基金：解析 → 映射引擎(13维) → 优化器 → 输出基金权重与投资计划。
"""
import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import get_parser_for_file, parse_fund_pdf
from mapping_engine import PortfolioMapper, TARGET_ASSET_CLASSES
from optimizer import PortfolioOptimizer, MODEL_PORTFOLIOS

ONEPAGE = Path(__file__).resolve().parent / "onepage"
if not ONEPAGE.exists():
    ONEPAGE = Path(r"D:\portoflio for mrf\onepage")


def main():
    # 1. 可选：只对部分基金做配置（这里用 onepage 下所有可解析 PDF；也可写死名单）
    pdfs = sorted(
        [p for p in ONEPAGE.glob("*.pdf") if get_parser_for_file(p) is not None],
        key=lambda p: p.name,
    )
    if not pdfs:
        print("未找到可解析的 PDF，请将文件放入 onepage/ 并确保文件名包含基金公司关键字。")
        return

    mapper = PortfolioMapper()
    available_funds = {}

    for path in pdfs:
        try:
            data = parse_fund_pdf(path)
            alloc = mapper.map_fund(data)
            available_funds[data.fund_name] = alloc
        except Exception as e:
            print(f"跳过 {path.name}: {e}")

    if not available_funds:
        print("没有成功映射的基金。")
        return

    print("=" * 60)
    print("已映射基金（13 维资产）共 %d 只" % len(available_funds))
    print("=" * 60)
    for name, alloc in list(available_funds.items())[:5]:
        total = sum(alloc.values())
        print("  %s  (合计 %.1f%%)" % (name[:40], total))
    if len(available_funds) > 5:
        print("  ... 共 %d 只" % len(available_funds))
    print()

    optimizer = PortfolioOptimizer()
    target_name = "均衡"
    print("目标模型: %s" % target_name)
    print("目标配置:", MODEL_PORTFOLIOS[target_name])
    print()

    try:
        weights = optimizer.optimize(available_funds, target_name)
        print("优化后基金权重 (%%):")
        for fund, pct in sorted(weights.items(), key=lambda x: -x[1]):
            print("  %s  %.2f%%" % (fund, pct))
        print()

        total_amount = 100_000.0
        plan = optimizer.generate_investment_plan(weights, total_amount)
        print("投资计划 (总投入 %.0f 元):" % total_amount)
        for fund, amount in sorted(plan.items(), key=lambda x: -x[1]):
            print("  %s  %.2f 元" % (fund, amount))
    except ValueError as e:
        print("优化失败:", e)


if __name__ == "__main__":
    main()
