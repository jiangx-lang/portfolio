# -*- coding: utf-8 -*-
"""Pydantic 数据模型：解析结果的结构化输出。"""

from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field


class TopHolding(BaseModel):
    """单条十大投资项目记录（股票型）。"""

    name: str = Field(..., description="投资标的名称，如 Tencent Holdings")
    market: str = Field(..., description="市场，如 中国内地")
    sector: str = Field(..., description="类别/行业，如 通讯服务")
    weight: float = Field(..., description="占资产净值比例(%)，如 5.1")


class BondHolding(BaseModel):
    """单条十大投资项目记录（债券型）：名称、票息率、到期日、占比。"""

    name: str = Field(..., description="债券名称，如 Us Department of The Treasury 3.88% 30/06/30")
    coupon_rate: float = Field(..., description="票息率(%)，如 3.88")
    maturity: str = Field(..., description="到期日，如 2030.06.30 或 30/06/30")
    weight: float = Field(..., description="占资产净值比例(%)，如 5.8")


class FundData(BaseModel):
    """基金说明书解析后的结构化数据。"""

    fund_name: str = Field(..., description="基金名称")
    portfolio_analysis: Dict[str, Dict[str, Optional[float]]] = Field(
        default_factory=dict,
        description="投资组合分析：指标名 -> {时间维度 -> 数值}，如 年化波幅(%) -> {近三年: 19.31, 近五年: 21.40}，缺失为 None",
    )
    top_10_holdings: List[TopHolding] = Field(
        default_factory=list,
        description="十大投资项目（股票型）：name, market, sector, weight",
    )
    top_10_bond_holdings: List[BondHolding] = Field(
        default_factory=list,
        description="十大投资项目（债券型）：name, coupon_rate, maturity, weight；纯股票基金为空列表",
    )
    market_allocation: Dict[str, float] = Field(
        default_factory=dict,
        description="市场/地区分布，如 {'中国内地': 31.9, '日本': 26.6}，数值为占比不含百分号",
    )
    sector_allocation: Dict[str, float] = Field(
        default_factory=dict,
        description="类别/行业分布，如 {'资讯科技': 55.6, '通讯服务': 17.6}，数值为占比不含百分号",
    )
    bond_metrics: Optional[Dict[str, float]] = Field(
        default=None,
        description="债券指标（仅债券/混合基金）：investment_grade_pct, high_yield_pct, avg_duration, avg_maturity, yield_to_maturity；纯股票基金为 None",
    )

    class Config:
        frozen = False
