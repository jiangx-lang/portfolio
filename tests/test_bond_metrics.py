# -*- coding: utf-8 -*-
"""验证债券指标解析：投资级/高收益、久期、期满收益率。"""
from parsers.jpm_parser import _parse_bond_metrics

SAMPLE = """
【样本片段5：投资组合特点】
债券评级 （%） AAA: 6.2
AA: 33.4
A: 31.7
BBB: 23.6
<BBB: 5.2
平均久期╱平均到期期限（年） 6.2/7.9
期满收益率（%） 5.26
"""

if __name__ == "__main__":
    m = _parse_bond_metrics(SAMPLE)
    print("bond_metrics:", m)
    if m:
        print("投资级(AAA+AA+A+BBB):", m.get("investment_grade_pct"), "预期 94.9")
        print("高收益(<BBB):", m.get("high_yield_pct"), "预期 5.2")
        print("久期/到期:", m.get("avg_duration"), m.get("avg_maturity"), "预期 6.2, 7.9")
        print("期满收益率:", m.get("yield_to_maturity"), "预期 5.26")
    # 纯股票基金无债券字段时应返回 None
    none_sample = "仅包含年化波幅、Sharpe 比率等，无债券评级。"
    print("纯股票样本 bond_metrics:", _parse_bond_metrics(none_sample))
