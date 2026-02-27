# -*- coding: utf-8 -*-
"""根据文件名自动选择对应的基金 PDF 解析器。"""

from pathlib import Path

from parsers.base_parser import BaseFundParser
from parsers.jpm_parser import JPMFundParser
from parsers.schemas import FundData


# 文件名/路径中若包含以下关键字，则使用对应解析器
JPM_KEYWORDS = ("摩根", "jpm", "jpmorgan")


def get_parser_for_file(file_path: str | Path) -> BaseFundParser | None:
    """
    根据文件路径或文件名推断应使用的解析器。

    Args:
        file_path: PDF 文件路径。

    Returns:
        对应的解析器实例，若无法识别则返回 None。
    """
    path = Path(file_path)
    name_lower = path.stem.lower()

    if any(kw in name_lower or kw in path.stem for kw in JPM_KEYWORDS):
        return JPMFundParser()

    return None


def parse_fund_pdf(file_path: str | Path) -> FundData:
    """
    自动选择解析器并解析 PDF，返回 FundData。

    Args:
        file_path: PDF 文件路径。

    Returns:
        解析后的 FundData。

    Raises:
        FileNotFoundError: 文件不存在。
        ValueError: 无法识别该基金公司或解析失败。
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {path}")

    parser = get_parser_for_file(path)
    if parser is None:
        raise ValueError(f"未找到适用于该文件的解析器: {path.stem}，请将文件命名包含支持的基金公司关键字（如：摩根）。")

    return parser.parse(path)
