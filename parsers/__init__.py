# -*- coding: utf-8 -*-
"""基金 PDF 解析器包：按基金公司区分的独立解析策略。"""

from parsers.base_parser import BaseFundParser
from parsers.schemas import BondHolding, FundData, TopHolding
from parsers.jpm_parser import JPMFundParser
from parsers.pictet_parser import PictetFundParser

__all__ = [
    "BaseFundParser",
    "BondHolding",
    "FundData",
    "TopHolding",
    "JPMFundParser",
    "PictetFundParser",
]
