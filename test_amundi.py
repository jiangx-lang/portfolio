# -*- coding: utf-8 -*-
"""东方汇理解析器验收：灵活配置增长 PDF。"""

import sys
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ONEPAGE = Path(__file__).resolve().parent / "onepage"
if not ONEPAGE.exists():
    ONEPAGE = Path(r"D:\portoflio for mrf\onepage")

PDF_NAME = "东方汇理香港组合 – 灵活配置增长.pdf"
PDF_PATH = ONEPAGE / PDF_NAME


def main() -> None:
    if not PDF_PATH.exists():
        print(f"未找到 PDF: {PDF_PATH}")
        return
    from parsers.amundi_parser import AmundiFundParser

    parser = AmundiFundParser()
    data = parser.parse(PDF_PATH)

    print("🎯 资产配置:", data.asset_allocation)
    print("🎯 股票 Top 10:", len(data.top_10_holdings), "条 ->", [x.name for x in data.top_10_holdings[:3]])
    print("🎯 债券 Top 10:", len(data.top_10_bond_holdings), "条 ->", [x.name for x in data.top_10_bond_holdings[:3]])
    print("🎯 地域分布:", len(data.market_allocation), "项 ->", list(data.market_allocation.keys()))
    print("🎯 行业分布:", len(data.sector_allocation), "项 ->", list(data.sector_allocation.keys()))

    # 验收标准
    ok = True
    if len(data.market_allocation) != 11:
        print(f"\n❌ 地域分布应为 11 项，当前 {len(data.market_allocation)} 项")
        ok = False
    if data.market_allocation.get("美国") != 51.05:
        print(f"❌ 地域分布应含 美国 51.05，当前 美国 = {data.market_allocation.get('美国')}")
        ok = False
    if "其他" not in data.market_allocation or data.market_allocation.get("其他") != 11.68:
        print(f"❌ 地域分布应含 其他 11.68，当前 其他 = {data.market_allocation.get('其他')}")
        ok = False
    if "现金及现金等值" not in data.market_allocation or data.market_allocation.get("现金及现金等值") != 0.92:
        v = data.market_allocation.get("现金及现金等值")
        print(f"❌ 地域分布应含 现金及现金等值 0.92，当前 = {v}")
        ok = False
    equity_names = [x.name.upper() for x in data.top_10_holdings]
    if "ALPHABET INC" not in equity_names and not any("ALPHABET" in n for n in equity_names):
        print("❌ 股票 Top 10 应出现 ALPHABET INC")
        ok = False
    if "NVIDIA CORP" not in equity_names and not any("NVIDIA" in n for n in equity_names):
        print("❌ 股票 Top 10 应出现 NVIDIA CORP")
        ok = False
    bond_names = [x.name.upper() for x in data.top_10_bond_holdings]
    if not any("US TSY" in n and "3.5" in n and "01/30" in n for n in bond_names):
        print("❌ 债券 Top 10 应出现 US TSY 3.5% 01/30")
        ok = False
    if "INC" in data.market_allocation or "CORP" in data.market_allocation:
        print("❌ 地域分布中不得出现 INC / CORP 等缩写")
        ok = False

    if ok:
        print("\n✅ 验收通过：东方汇理这座大山已被夷平！")
    else:
        print("\n⚠️ 部分验收未通过，请根据上述提示调整解析逻辑。")


if __name__ == "__main__":
    main()
