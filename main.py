# -*- coding: utf-8 -*-
"""
Portfolio Matcher - 基金投资组合匹配系统
入口脚本：使用 fund_factory 解析 onepage 目录下的摩根 PDF，并打印 FundData。
"""

import json
import sys
from pathlib import Path

# 控制台输出 UTF-8，避免 Windows 下中文乱码
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import parse_fund_pdf
from parsers.schemas import FundData


def format_fund_summary(data: FundData, index: int) -> str:
    """将单只 FundData 格式化为「摩根产品一览」风格的可读汇总（含投资组合分析、十大持仓、市场/类别分布、债券指标）。"""
    lines = [f"{index}. {data.fund_name}"]

    # 投资组合分析
    pa = data.portfolio_analysis
    if pa:
        parts = []
        if "年化波幅(%)" in pa:
            v = pa["年化波幅(%)"]
            vals = [str(v.get("近三年")), str(v.get("近五年")), str(v.get("自成立至今"))]
            vals = [x if x != "None" else "无" for x in vals]
            parts.append(f"年化波幅 近三/五/成立 {' / '.join(vals)}")
        if "Sharpe比率" in pa:
            v = pa["Sharpe比率"]
            vals = [str(v.get("近三年")) if v.get("近三年") is not None else "无",
                    str(v.get("近五年")) if v.get("近五年") is not None else "无",
                    str(v.get("自成立至今")) if v.get("自成立至今") is not None else "无"]
            parts.append(f"Sharpe {' / '.join(vals)}")
        if "平均每年回报(%)" in pa:
            v = pa["平均每年回报(%)"]
            vals = [str(v.get("近三年")), str(v.get("近五年")), str(v.get("自成立至今"))]
            vals = [x if x != "None" else "无" for x in vals]
            parts.append(f"平均每年回报 {' / '.join(vals)}")
        lines.append("投资组合分析：" + "；".join(parts))
    else:
        lines.append("投资组合分析：无（该 PDF 未解析到该表）")

    # 十大持仓（股票部分）
    holdings = data.top_10_holdings
    if holdings:
        items = [f"{h.name} {h.weight}" for h in holdings]
        lines.append("十大持仓：" + "、".join(items))
    else:
        lines.append("十大持仓：无（债券型，未解析到股票持仓）")

    # 十大债券持仓（债券型）
    bond_holdings = data.top_10_bond_holdings
    if bond_holdings:
        items = [f"{h.name} 票息{h.coupon_rate}% 到期{h.maturity} {h.weight}%" for h in bond_holdings]
        lines.append("十大债券持仓：" + "； ".join(items))

    # 市场分布
    market = data.market_allocation
    if market:
        items = [f"{k} {v}" for k, v in sorted(market.items(), key=lambda x: -x[1])]
        lines.append("市场分布：" + "、".join(items))
    else:
        lines.append("市场分布：无")

    # 类别分布
    sector = data.sector_allocation
    if sector:
        items = [f"{k} {v}" for k, v in sorted(sector.items(), key=lambda x: -x[1])]
        lines.append("类别分布：" + "、".join(items))
    else:
        lines.append("类别分布：无")

    # 债券指标（若有）
    bm = data.bond_metrics
    if bm:
        parts = []
        if "investment_grade_pct" in bm:
            parts.append(f"投资级占比 {bm['investment_grade_pct']}%")
        if "high_yield_pct" in bm:
            parts.append(f"高收益占比 {bm['high_yield_pct']}%")
        if "avg_duration" in bm:
            parts.append(f"平均久期 {bm['avg_duration']} 年")
        if "avg_maturity" in bm:
            parts.append(f"平均到期 {bm['avg_maturity']} 年")
        if "yield_to_maturity" in bm:
            parts.append(f"期满收益率 {bm['yield_to_maturity']}%")
        if parts:
            lines.append("债券指标：" + "、".join(parts))

    return "\n".join(lines)


def main() -> None:
    # 优先解析 onepage 目录下包含「摩根」的 PDF
    project_root = Path(__file__).resolve().parent
    onepage_dir = project_root / "onepage"

    if not onepage_dir.is_dir():
        print(f"未找到 onepage 目录: {onepage_dir}")
        print("请将《摩根太平洋科技》等 PDF 放入 onepage 目录后重试。")
        return

    pdfs = list(onepage_dir.glob("*.pdf"))
    jpm_pdfs = [p for p in pdfs if "摩根" in p.stem or "jpm" in p.stem.lower()]

    if not jpm_pdfs:
        print(f"onepage 目录下未找到摩根相关 PDF。当前 PDF 列表: {[p.name for p in pdfs]}")
        return

    results: list[tuple[Path, FundData]] = []
    for pdf_path in jpm_pdfs:
        try:
            data = parse_fund_pdf(pdf_path)
            results.append((pdf_path, data))
        except FileNotFoundError as e:
            print("文件不存在:", e)
        except ValueError as e:
            print("解析失败:", e)

    if not results:
        return

    print("摩根产品一览")
    print()
    for i, (pdf_path, data) in enumerate(results, 1):
        print(format_fund_summary(data, i))
        print()
    print("以上即为本次运行解析出的摩根所有产品汇总；如需某一只的完整 JSON 或只保留某几项字段，可以说下要哪只、要哪些字段。")


if __name__ == "__main__":
    main()
