"""
data/benchmarks.py
渣打 Model Portfolio 三档基准配置
（用于组合构建器的偏差对比）

替换为你们真实的 CIO 数据即可，结构保持不变：
  key = 组合名称（对应 st.selectbox 选项）
  value = {tag_name: 目标得分/权重}
"""

BENCHMARKS: dict[str, dict[str, float]] = {

    "渣打保守型 Conservative": {
        "Bond":            50.0,
        "Low Vol":         40.0,
        "Income/Dividend": 15.0,
        "HALO":             5.0,
        "Quality":          8.0,
        "US":              30.0,
    },

    "渣打稳健型 Balanced": {
        "Bond":            35.0,
        "Equity":          50.0,
        "AI Hardware":      8.0,
        "AI Software":      6.0,
        "Technology":      15.0,
        "Asia":            12.0,
        "HALO":            10.0,
        "Income/Dividend":  8.0,
        "Quality":         12.0,
        "US":              25.0,
    },

    "渣打成长型 Growth": {
        "AI Hardware":     15.0,
        "AI Software":     12.0,
        "Technology":      22.0,
        "Semiconductor":   12.0,
        "China Internet":   8.0,
        "Asia":            15.0,
        "HALO":            12.0,
        "Mega Cap":        20.0,
        "US":              35.0,
    },

}
