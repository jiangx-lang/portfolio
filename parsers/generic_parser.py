# -*- coding: utf-8 -*-
"""通用 PDF 解析器：仅提取基金名（来自文件名），持仓留空。用于暂无专用解析器的基金（如施罗德）。"""

from pathlib import Path

from parsers.base_parser import BaseFundParser
from parsers.schemas import FundData


class GenericParser(BaseFundParser):
    """通用解析器：返回 fund_name=文件名，top_10_holdings 与 top_10_bond_holdings 为空。"""

    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")
        fund_name = path.stem
        return FundData(
            fund_name=fund_name,
            top_10_holdings=[],
            top_10_bond_holdings=[],
        )
