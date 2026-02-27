# -*- coding: utf-8 -*-
"""解析器抽象基类：统一接口，各家基金公司实现具体解析逻辑。"""

from abc import ABC, abstractmethod
from pathlib import Path

from parsers.schemas import FundData


class BaseFundParser(ABC):
    """基金 PDF 解析器抽象基类。子类需实现 parse() 并返回 FundData。"""

    @abstractmethod
    def parse(self, file_path: str | Path) -> FundData:
        """
        解析指定 PDF 文件，返回结构化 FundData。

        Args:
            file_path: PDF 文件路径。

        Returns:
            解析后的 FundData（含 fund_name, market_allocation, sector_allocation）。

        Raises:
            FileNotFoundError: 文件不存在。
            ValueError: 文件无法解析或内容不符合预期。
        """
        pass

    def _extract_text_from_pdf(self, path: Path) -> str:
        """从 PDF 提取全文，供子类复用。"""
        import pdfplumber

        text_parts: list[str] = []
        try:
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    raw = page.extract_text()
                    if raw:
                        text_parts.append(raw)
        except Exception as e:
            raise ValueError(f"无法从 PDF 提取文本: {path}") from e
        return "\n".join(text_parts)

    def _extract_tables_from_pdf(self, path: Path) -> list[list[list[str | None]]]:
        """
        从 PDF 逐页提取表格，供子类复用。
        Returns: 所有页的表格合并为列表，每个表格为 list[list[cell]]，cell 为 str 或 None。
        """
        import pdfplumber

        all_tables: list[list[list[str | None]]] = []
        try:
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    if tables:
                        for t in tables:
                            rows = []
                            for row in t or []:
                                cells = []
                                for c in row:
                                    if c is None:
                                        cells.append(None)
                                    else:
                                        cells.append(str(c).strip())
                                rows.append(cells)
                            all_tables.append(rows)
        except Exception as e:
            raise ValueError(f"无法从 PDF 提取表格: {path}") from e
        return all_tables
