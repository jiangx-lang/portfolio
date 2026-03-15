"""一次性修正 cn-fs-qdur003 的入库数据（按 PDF 截图核对）"""
import sqlite3

conn = sqlite3.connect("sc_funds.db")

# 1. funds: 成立日期 1997-01-03；Bloomberg 按说明书；年度费用统计写入 other_fees_note
conn.execute("""
    UPDATE funds SET
        inception_date = '1997-01-03',
        bloomberg_codes = 'MERGAAI LX,MGHMLA2 LX,BGA2AUD LX,BGGA2CH LX',
        other_fees_note = '其他费用由境外产品发行人决定。管理费与行政费综合总额最高可提高至2.25%。'
    WHERE source_file = 'cn-fs-qdur003.pdf'
""")

# 2. fund_performance: 累积表现列对齐（本基金行）；单年度表现；基准
# 累积表现：3m=3.94, 6m=10.09, 1y=17.12, 3y=40.83, 5y=30.67, since_inception=590.40
# 单年度：ytd=2.58, 2021=6.27, 2022=-16.33, 2023=12.52, 2024=8.82, 2025=17.40
# 基准：bench_ret_3m=3.75, bench_ret_1y=17.85, bench_ret_3y=44.64, bench_ret_5y=42.71, bench_ret_since_inception=592.55
conn.execute("""
    UPDATE fund_performance SET
        ret_ytd = 2.58,
        ret_1y = 17.12,
        ret_3y = 40.83,
        ret_5y = 30.67,
        ret_since_inception = 590.40,
        ret_2021 = 6.27,
        ret_2022 = -16.33,
        ret_2023 = 12.52,
        ret_2024 = 8.82,
        ret_2025 = 17.40,
        bench_ret_3m = 3.75,
        bench_ret_1y = 17.85,
        bench_ret_3y = 44.64,
        bench_ret_5y = 42.71,
        bench_ret_since_inception = 592.55
    WHERE fund_id = 1 AND share_class = 'A2美元股份' AND as_of_date = '2026-01-31'
""")

conn.commit()
conn.close()
print("OK: cn-fs-qdur003 已修正（inception_date, bloomberg_codes, performance 列）")
