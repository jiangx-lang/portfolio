# -*- coding: utf-8 -*-
"""
Phase 3 - 组合优化内核 (Portfolio Optimizer)
基于 Markowitz 均值-方差框架的二次规划：min ||Aw - b||^2，s.t. sum(w)=1, 0<=w<=1。
"""
import numpy as np
from scipy.optimize import minimize
from typing import Dict, List

# 13 维标准资产类 (必须与映射引擎完全一致)
TARGET_ASSET_CLASSES = [
    '美元现金', '发达市场投资级政府债', '发达市场投资级公司债', '发达市场高收益公司债',
    '新兴市场美元政府债', '新兴市场本币政府债', '亚洲美元债', '北美股票',
    '欧洲（除英国）股票', '英国股票', '日本股票', '亚洲（除日本）股票', '黄金'
]

# 目标投资组合模型 (各项加总必须为 100)
MODEL_PORTFOLIOS = {
    "平稳": {
        "美元现金": 2.0, "发达市场投资级政府债": 25.0, "发达市场投资级公司债": 10.0, "发达市场高收益公司债": 1.0,
        "新兴市场美元政府债": 8.0, "新兴市场本币政府债": 6.0, "亚洲美元债": 8.0, "北美股票": 24.0,
        "欧洲（除英国）股票": 3.0, "英国股票": 0.0, "日本股票": 1.0, "亚洲（除日本）股票": 6.0, "黄金": 6.0
    },
    "均衡": {
        "美元现金": 2.0, "发达市场投资级政府债": 16.0, "发达市场投资级公司债": 5.0, "发达市场高收益公司债": 1.0,
        "新兴市场美元政府债": 6.0, "新兴市场本币政府债": 5.0, "亚洲美元债": 5.0, "北美股票": 38.0,
        "欧洲（除英国）股票": 6.0, "英国股票": 1.0, "日本股票": 2.0, "亚洲（除日本）股票": 7.0, "黄金": 6.0
    },
    "进取": {
        "美元现金": 2.0, "发达市场投资级政府债": 8.0, "发达市场投资级公司债": 1.0, "发达市场高收益公司债": 0.0,
        "新兴市场美元政府债": 4.0, "新兴市场本币政府债": 2.0, "亚洲美元债": 3.0, "北美股票": 51.0,
        "欧洲（除英国）股票": 8.0, "英国股票": 2.0, "日本股票": 3.0, "亚洲（除日本）股票": 10.0, "黄金": 6.0
    }
}


class PortfolioOptimizer:
    def __init__(self):
        self.asset_classes = TARGET_ASSET_CLASSES

    def optimize(self, available_funds: Dict[str, Dict[str, float]], target_model_name: str) -> Dict[str, float]:
        """
        核心优化器：寻找最优基金权重
        available_funds: { "摩根基金A": {"北美股票": 50.0, ...}, ... }
        """
        if target_model_name not in MODEL_PORTFOLIOS:
            raise ValueError(f"未知目标模型: {target_model_name}")

        target_portfolio = MODEL_PORTFOLIOS[target_model_name]

        # 1. 构建目标向量 b
        b = np.array([target_portfolio.get(ac, 0.0) for ac in self.asset_classes])

        fund_names = list(available_funds.keys())
        n_funds = len(fund_names)
        if n_funds == 0:
            return {}

        # 2. 构建特征矩阵 A (每列是一只基金的资产配置)
        A = np.zeros((len(self.asset_classes), n_funds))
        for j, fund_name in enumerate(fund_names):
            fund_alloc = available_funds[fund_name]
            for i, ac in enumerate(self.asset_classes):
                A[i, j] = fund_alloc.get(ac, 0.0)

        # 3. 定义目标函数：最小化均方误差 (Aw - b)^2
        def objective(w):
            diff = A @ w - b
            return np.sum(diff ** 2)

        # 4. 约束条件：权重总和为 1，且每个权重在 0 到 1 之间
        constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0})
        bounds = tuple((0.0, 1.0) for _ in range(n_funds))

        # 初始猜测：等权重分配
        w0 = np.ones(n_funds) / n_funds

        # 5. 执行 SLSQP 二次规划求解
        result = minimize(objective, w0, method='SLSQP', bounds=bounds, constraints=constraints)

        if not result.success:
            print(f"⚠️ 优化器提示: {result.message}")

        # 6. 结果清洗：剔除 < 1% 的碎股配置
        optimized_weights = {}
        for i, name in enumerate(fund_names):
            weight = result.x[i]
            if weight > 0.01:
                optimized_weights[name] = weight

        # 7. 重新归一化至 100%
        total_weight = sum(optimized_weights.values())
        for name in optimized_weights:
            optimized_weights[name] = round((optimized_weights[name] / total_weight) * 100, 2)

        return optimized_weights

    def generate_investment_plan(self, optimized_weights: Dict[str, float], total_amount: float) -> Dict[str, float]:
        """根据权重和总投资额生成具体的买入金额"""
        plan = {}
        for fund, weight_pct in optimized_weights.items():
            plan[fund] = round(total_amount * (weight_pct / 100.0), 2)
        return plan
