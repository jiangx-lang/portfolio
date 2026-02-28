# -*- coding: utf-8 -*-
"""
瑞士百达 (Pictet) 基金 PDF 解析器。
无边框排版导致 extract_tables() 常为空，故采用 page.extract_text(layout=True) + 高精度正则直抽：
投资组合特性（波幅/夏普）、资产配置、十大持仓。
"""

import re
from pathlib import Path
from typing import Callable

from parsers.base_parser import BaseFundParser
from parsers.schemas import FundData, TopHolding


# 目标数据页（第 4 页，0-based 索引 3）
_PICTET_TARGET_PAGE_INDEX = 3

# 资产配置关键字（全文 finditer 狙击，繁体黃金 后处理为 黄金）
_ASSET_KWS = [
    "北美股票",
    "亚太股票",
    "发达市场政府债券",
    "黄金",
    "黃金",
    "新兴市场政府债券",
    "信用投资级债券",
    "欧洲股票",
    "房地产",
    "信用高收益债券",
    "现金及等价物",
]


def _get_text(path: Path, fallback_full_text: Callable[[Path], str]) -> str:
    """优先用第 4 页 layout 文本，否则用 fallback 全文。"""
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages) > _PICTET_TARGET_PAGE_INDEX:
                text = pdf.pages[_PICTET_TARGET_PAGE_INDEX].extract_text(layout=True)
                if text and text.strip():
                    return text
    except Exception:
        pass
    return fallback_full_text(path)


def _parse_portfolio_analysis(text: str) -> dict[str, dict[str, float | None]]:
    """波幅、夏普：强制匹配小数，避免把「3年」里的 3 抓出来。"""
    result: dict[str, dict[str, float | None]] = {}
    template = {"近三年": None, "近五年": None, "自成立至今": None}

    vol_match = re.search(r"波幅.*?(?:%|）|\))\s*(\d+\.\d+)", text)
    if vol_match:
        try:
            v = float(vol_match.group(1))
            if 0 < v < 100:
                result["年化波幅(%)"] = {**template, "近三年": v}
        except ValueError:
            pass

    sharpe_match = re.search(r"夏普比率.*?(?:%|）|\))\s*(\d+\.\d+)", text)
    if sharpe_match:
        try:
            s = float(sharpe_match.group(1))
            if -5 < s < 5:
                result["Sharpe比率"] = {**template, "近三年": s}
        except ValueError:
            pass

    return result


def _parse_asset_allocation(text: str) -> dict[str, float]:
    """资产配置：关键字 + 紧跟小数，finditer 直抽。"""
    asset_allocation: dict[str, float] = {}
    pattern = r"(" + "|".join(re.escape(k) for k in _ASSET_KWS) + r")\s+(\d+\.\d+)"
    for match in re.finditer(pattern, text):
        name = match.group(1).replace("黃金", "黄金")
        try:
            val = float(match.group(2))
            if 0 <= val <= 100:
                asset_allocation[name] = round(val, 2)
        except ValueError:
            continue
    return asset_allocation


def _parse_top_10_holdings(text: str) -> list[TopHolding]:
    """十大持仓：按行匹配「首字母大写 + 英文/数字/空格/%，结尾为两位小数权重」。"""
    top_10: list[TopHolding] = []
    # 匹配示例: "Us Treasury N/B 4.125% 15.11.2032 Uns      6.14"
    holding_re = re.compile(r"^([A-Z][A-Za-z0-9\s\-\/\.%&]+?)\s+(\d+\.\d{2})(?=\s|$)")
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        holding_match = holding_re.search(line)
        if not holding_match:
            continue
        name = holding_match.group(1).strip()
        if any(kw in name for kw in _ASSET_KWS):
            continue
        try:
            weight = float(holding_match.group(2))
            if 0 < weight <= 100:
                top_10.append(TopHolding(name=name, market="", sector="", weight=round(weight, 2)))
        except ValueError:
            continue
    return top_10[:10]


class PictetFundParser(BaseFundParser):
    """
    百达基金 PDF 解析器（全文 layout 文本 + 高精度正则）。
    不再使用 extract_tables()，避免无边框排版返回空。
    """

    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        fund_name = path.stem
        text = ""

        try:
            text = _get_text(path, self._extract_text_from_pdf)
        except Exception:
            pass

        if not text:
            return FundData(
                fund_name=fund_name,
                portfolio_analysis={},
                top_10_holdings=[],
                top_10_bond_holdings=[],
                market_allocation={},
                sector_allocation={},
                bond_metrics=None,
                asset_allocation=None,
            )

        portfolio_analysis: dict[str, dict[str, float | None]] = {}
        asset_allocation: dict[str, float] | None = None
        top_10_holdings: list[TopHolding] = []

        try:
            portfolio_analysis = _parse_portfolio_analysis(text)
        except Exception:
            portfolio_analysis = {}

        try:
            asset_allocation = _parse_asset_allocation(text)
            if not asset_allocation:
                asset_allocation = None
        except Exception:
            asset_allocation = None

        try:
            top_10_holdings = _parse_top_10_holdings(text)
        except Exception:
            top_10_holdings = []

        return FundData(
            fund_name=fund_name,
            portfolio_analysis=portfolio_analysis,
            top_10_holdings=top_10_holdings,
            top_10_bond_holdings=[],
            market_allocation={},
            sector_allocation={},
            bond_metrics=None,
            asset_allocation=asset_allocation,
        )
