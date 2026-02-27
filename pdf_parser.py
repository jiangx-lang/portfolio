# -*- coding: utf-8 -*-
"""
PDF 解析模块 - 基金投资组合匹配系统 (Portfolio Matcher)
用于解析摩根 (JPMorgan) 等格式的基金 Onepage PDF，提取市场分布与类别分布。
"""

from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber

# 后续解析市场/类别分布时可使用: import regex


class FundFactsheetParser:
    """
    基金说明书 PDF 解析器。
    负责从指定格式的 PDF 中提取「市场分布」「类别分布」等结构化数据。
    """

    def __init__(self) -> None:
        """初始化解析器，可在此配置默认选项。"""
        pass

    def parse_jpm_pdf(self, file_path: str | Path) -> dict[str, Any] | pd.DataFrame:
        """
        解析摩根 (JPMorgan) 格式的中文 Onepage PDF。

        目标提取字段：
        - 市场分布：如 中国内地 31.9%, 日本 26.6%
        - 类别分布：如 资讯科技 55.6%, 通讯服务 17.6%

        Args:
            file_path: PDF 文件路径（字符串或 Path 对象）。

        Returns:
            包含 "市场分布" 与 "类别分布" 的字典或 DataFrame。
            结构示例：
            {
                "市场分布": {"中国内地": 31.9, "日本": 26.6, ...},
                "类别分布": {"资讯科技": 55.6, "通讯服务": 17.6, ...}
            }

        Raises:
            FileNotFoundError: 文件不存在。
            ValueError: 文件格式不可解析或内容无法识别。
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")

        if not path.suffix.lower() == ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        try:
            # --------------------------------------------
            # 第一步：打开 PDF 并提取文本/表格（占位）
            # 后续可在此使用 pdfplumber.open(path) 提取页面与表格
            # --------------------------------------------
            raw_text = self._extract_text_from_pdf(path)
            # raw_tables = self._extract_tables_from_pdf(path)  # 若用表格可在此调用

            # --------------------------------------------
            # 第二步：从文本/表格中解析「市场分布」「类别分布」
            # 后续可在此使用 regex 或坐标/关键词定位逻辑
            # --------------------------------------------
            market_dist = self._parse_market_distribution(raw_text)
            category_dist = self._parse_category_distribution(raw_text)

            result: dict[str, Any] = {
                "市场分布": market_dist,
                "类别分布": category_dist,
            }
            return result
            # 若需统一返回 DataFrame，可在此构造并 return pd.DataFrame(...)

        except FileNotFoundError:
            raise
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"解析 PDF 时发生错误: {path}") from e

    def _extract_text_from_pdf(self, path: Path) -> str:
        """
        从 PDF 中提取全文。
        使用 pdfplumber 逐页提取 text，后续可在此增加表格提取。
        """
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

    def _parse_market_distribution(self, raw_text: str) -> dict[str, float]:
        """
        从原始文本中解析「市场分布」。
        返回格式：{"中国内地": 31.9, "日本": 26.6, ...}
        后续可在此编写 regex 或基于关键词/表格的解析逻辑。
        """
        # TODO: 正则或表格解析，提取地区名与占比
        return {}

    def _parse_category_distribution(self, raw_text: str) -> dict[str, float]:
        """
        从原始文本中解析「类别分布」。
        返回格式：{"资讯科技": 55.6, "通讯服务": 17.6, ...}
        后续可在此编写 regex 或基于关键词/表格的解析逻辑。
        """
        # TODO: 正则或表格解析，提取行业类别与占比
        return {}
