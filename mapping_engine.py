# -*- coding: utf-8 -*-
"""
Phase 2 - 映射引擎 (Mapping Engine)
将基金底层持仓 (FundData) 转换为标准 Model Portfolio 的 13 类资产，供后续组合对比与优化。
"""

import logging
import warnings
from typing import Dict, List

from parsers.schemas import FundData


# 标准资产类别（与 Product Owner 模板一致，共 13 类）
TARGET_ASSET_CLASSES: List[str] = [
    "美元现金",
    "发达市场投资级政府债",
    "发达市场投资级公司债",
    "发达市场高收益公司债",
    "新兴市场美元政府债",
    "新兴市场本币政府债",
    "亚洲美元债",
    "北美股票",
    "欧洲（除英国）股票",
    "英国股票",
    "日本股票",
    "亚洲（除日本）股票",
    "黄金",
]

# 专家干预字典：解析器无法可靠产出时，直接打补丁（Phase 1 封测后的工程化解法）
STATIC_OVERRIDES: Dict[str, Dict[str, float]] = {
    "中銀香港環球股票基金": {
        "北美股票": 65.1,
        "欧洲（除英国）股票": 10.1,
        "亚洲（除日本）股票": 5.3,
        "英国股票": 3.0,
        "日本股票": 2.6,
        "美元现金": 3.3,
    },
}

# 债券型基金静态映射（基金名 -> 债券部分在各目标债券类别中的占比，和为 100）
# 现金部分会从 market/sector 中单独扣除后映射到「美元现金」，再按此比例分配剩余部分
BOND_STATIC_MAPPING: Dict[str, Dict[str, float]] = {
    "摩根国际债": {
        "发达市场投资级政府债": 40.0,
        "发达市场投资级公司债": 50.0,
        "发达市场高收益公司债": 10.0,
    },
    "摩根亚洲总收益": {
        "亚洲美元债": 50.0,
        "新兴市场美元政府债": 25.0,
        "发达市场投资级公司债": 25.0,
    },
}

# 市场 -> 标准股票类别（便于后续扩展）
MARKET_TO_EQUITY_CLASS: Dict[str, str] = {
    "日本": "日本股票",
    "中国内地": "亚洲（除日本）股票",
    "中国香港": "亚洲（除日本）股票",
    "中国台湾": "亚洲（除日本）股票",
    "韩国": "亚洲（除日本）股票",
    "印度": "亚洲（除日本）股票",
    "新加坡": "亚洲（除日本）股票",
    "澳门": "亚洲（除日本）股票",
    "印度尼西亚": "亚洲（除日本）股票",
    "马来西亚": "亚洲（除日本）股票",
    "泰国": "亚洲（除日本）股票",
    "北美": "北美股票",
    "英国": "英国股票",
    "成熟欧洲": "欧洲（除英国）股票",
    "欧洲": "欧洲（除英国）股票",
}

# 现金类在原始数据中的可能键名（market_allocation / sector_allocation）
CASH_KEYS: tuple = ("流动资金", "现金", "Cash", "流动资金及现金")

# 日志
logger = logging.getLogger(__name__)


class MappingWarning(UserWarning):
    """映射过程中未覆盖的资产需人工补充规则时使用。"""
    pass


class PortfolioMapper:
    """
    将 FundData 映射为 TARGET_ASSET_CLASSES 上的权重字典。
    输出键仅包含上述 13 类，值为百分比，总和应接近 100。
    """

    def __init__(
        self,
        target_classes: List[str] | None = None,
        bond_static_mapping: Dict[str, Dict[str, float]] | None = None,
        market_to_equity: Dict[str, str] | None = None,
    ) -> None:
        self.target_classes = target_classes or list(TARGET_ASSET_CLASSES)
        self.bond_static = bond_static_mapping or dict(BOND_STATIC_MAPPING)
        self.market_to_equity = market_to_equity or dict(MARKET_TO_EQUITY_CLASS)

    def map_fund(self, fund_data: FundData) -> Dict[str, float]:
        """
        将单只基金解析结果映射为标准资产类别权重。

        Args:
            fund_data: Phase 1 解析得到的 FundData。

        Returns:
            键为 TARGET_ASSET_CLASSES 中的类别，值为占比（float），未出现的类别为 0。
            总和应接近 100（可能因四舍五入或未映射的 Other 略有偏差）。
        """
        result = {k: 0.0 for k in self.target_classes}

        try:
            # 专家干预：若在静态补丁表中，直接返回（不再走解析映射）
            if fund_data.fund_name in STATIC_OVERRIDES:
                override = STATIC_OVERRIDES[fund_data.fund_name]
                for ac in self.target_classes:
                    result[ac] = override.get(ac, 0.0)
                self._normalize_result(result)
                return result

            cash_pct = self._extract_cash_pct(fund_data)
            result["美元现金"] = round(cash_pct, 2)

            if fund_data.bond_metrics is not None and fund_data.fund_name in self.bond_static:
                self._apply_bond_static_mapping(fund_data, cash_pct, result)
            else:
                self._apply_equity_mapping(fund_data, cash_pct, result)

            self._normalize_result(result)
        except Exception as e:
            logger.exception("map_fund 失败: fund_name=%s", fund_data.fund_name)
            raise ValueError(f"映射失败 [{fund_data.fund_name}]: {e}") from e

        return result

    def _extract_cash_pct(self, fund_data: FundData) -> float:
        """从 market_allocation 与 sector_allocation 中提取现金/流动资金占比。"""
        total = 0.0
        for d in (fund_data.market_allocation, fund_data.sector_allocation):
            for k, v in (d or {}).items():
                if k in CASH_KEYS or (k and "现金" in k) or (k and "流动资金" in k):
                    total += float(v)
                    break
        return min(100.0, total)

    def _apply_bond_static_mapping(
        self,
        fund_data: FundData,
        cash_pct: float,
        result: Dict[str, float],
    ) -> None:
        """债券型基金：现金已入美元现金，剩余部分按 BOND_STATIC_MAPPING 分配。"""
        bond_weights = self.bond_static.get(fund_data.fund_name)
        if not bond_weights:
            return
        non_cash = 100.0 - cash_pct
        if non_cash <= 0:
            return
        total_bond_rule = sum(bond_weights.values())
        if total_bond_rule <= 0:
            return
        for asset, pct in bond_weights.items():
            if asset in result:
                result[asset] = round(non_cash * (pct / total_bond_rule), 2)

    def _map_equity_markets(self, source_dict: Dict[str, float], target_dict: Dict[str, float]) -> None:
        """处理股票型地域分布组装：关键词匹配北美/日本/英国/欧洲/亚洲/现金。"""
        for src_key, weight in source_dict.items():
            if not src_key or weight <= 0:
                continue
            k = src_key.upper()
            # 1. 北美
            if any(x in k for x in ["美国", "加拿大", "北美"]):
                target_dict["北美股票"] += weight
            # 2. 日本
            elif "日本" in k and "除" not in k:
                target_dict["日本股票"] += weight
            # 3. 英国
            elif "英国" in k and "除" not in k:
                target_dict["英国股票"] += weight
            # 4. 欧洲 (除英国)
            elif any(x in k for x in ["欧洲", "法国", "德国", "意大利", "瑞士", "荷兰", "西班牙"]):
                target_dict["欧洲（除英国）股票"] += weight
            # 5. 亚洲 (除日本) - 大中华及泛亚词库
            elif any(x in k for x in ["中国", "台湾", "香港", "澳门", "韩国", "南韩", "印度", "印尼",
                                      "新加坡", "泰国", "马来西亚", "菲律宾", "亚洲", "亚太", "A股", "H股", "红筹"]):
                target_dict["亚洲（除日本）股票"] += weight
            # 6. 现金
            elif any(x in k for x in ["现金", "流动资金", "存款"]):
                target_dict["美元现金"] += weight
            # 其他（如澳大利亚、拉美）暂不处理，依赖归一化自动平摊

    def _apply_equity_mapping(
        self,
        fund_data: FundData,
        cash_pct: float,
        result: Dict[str, float],
    ) -> None:
        """股票型（或未配置债券静态映射的）基金：按 market_allocation 映射到股票类别。"""
        market = fund_data.market_allocation or {}
        non_cash = 100.0 - cash_pct
        if non_cash <= 0:
            return
        # 现金已单独写入，只把非现金地域交给 _map_equity_markets
        non_cash_market = {
            k: v for k, v in market.items()
            if k and v > 0 and k not in CASH_KEYS and "现金" not in k and "流动资金" not in k
        }
        self._map_equity_markets(non_cash_market, result)

    def _normalize_result(self, result: Dict[str, float]) -> None:
        """确保结果只包含 target_classes 中的键；若总和与 100 偏差较大则按比例缩放。"""
        keys_to_remove = [k for k in result if k not in self.target_classes]
        for k in keys_to_remove:
            del result[k]
        total = sum(result.values())
        if total <= 0:
            return
        if abs(total - 100.0) > 0.5:
            for k in result:
                result[k] = round(100.0 * result[k] / total, 2)
            result["美元现金"] = round(
                100.0 - sum(v for k, v in result.items() if k != "美元现金"),
                2,
            )
