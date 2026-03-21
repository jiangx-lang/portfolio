# -*- coding: utf-8 -*-
"""直接把 3 只基金（施罗德、摩根国际债、摩根亚洲总收益）的持仓写入 Supabase mrf_holdings，数据已从 PDF 提取，无需 parser。"""
import os
from pathlib import Path

# 项目根目录，支持多种 .env 位置
ROOT = Path(__file__).resolve().parent
for env_path in ["qdii_portfolio/.env", ".env", "mf-holdings-dashboard/.env.local"]:
    p = ROOT / env_path.replace("/", os.sep)
    if p.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(p)
            break
        except ImportError:
            # 无 dotenv 时手动加载
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    key, val = k.strip(), v.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
            break

from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

holdings = [
    # ==========================================
    # 施罗德亚洲高息股债基金 (968013) 截至30/9/2025
    # ==========================================
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 1, "holding_name": "台积电", "holding_type": "equity", "weight_pct": 2.29, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 2, "holding_name": "CHINA CONSTRUCTION BANK CORP H", "holding_type": "equity", "weight_pct": 1.78, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 3, "holding_name": "HON HAI PRECISION INDUSTRY LTD", "holding_type": "equity", "weight_pct": 1.69, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 4, "holding_name": "DBS GROUP HOLDINGS LTD", "holding_type": "equity", "weight_pct": 1.59, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 5, "holding_name": "联发科技", "holding_type": "equity", "weight_pct": 1.34, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 6, "holding_name": "WOORI BANK AT1-P 6.375 31-DEC-2079", "holding_type": "bond", "weight_pct": 0.74, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 7, "holding_name": "SUMITOMO LIFE INSURANCE CO PERP 5.875", "holding_type": "bond", "weight_pct": 0.71, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 8, "holding_name": "BANK NEGARA INDONESIA PERSERO TBK AT1-P 4.3", "holding_type": "bond", "weight_pct": 0.70, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 9, "holding_name": "MEIJI YASUDA LIFE INSURANCE CO HYBRID 5.8", "holding_type": "bond", "weight_pct": 0.70, "as_of_date": "2025-09-30"},
    {"sc_product_code": "施罗德亚洲高息股债基金M类别(人民币派息)", "fund_name": "施罗德亚洲高息股债基金M类别(人民币派息)", "rank": 10, "holding_name": "WYNN MACAU LTD 5.5 01-OCT-2027", "holding_type": "bond", "weight_pct": 0.57, "as_of_date": "2025-09-30"},

    # ==========================================
    # 摩根国际债券基金 (968050) 截至2025年11月底
    # ==========================================
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 1, "holding_name": "US Department of The Treasury 3.88% 2030.06.30", "holding_type": "bond", "weight_pct": 5.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 2, "holding_name": "United Kingdom of Great Britain 4.50% 2035.03.07", "holding_type": "bond", "weight_pct": 5.7, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 3, "holding_name": "Republic of Italy 3.65% 2035.08.01", "holding_type": "bond", "weight_pct": 4.3, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 4, "holding_name": "French Republic 3.50% 2035.11.25", "holding_type": "bond", "weight_pct": 2.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 5, "holding_name": "US Department of The Treasury 3.63% 2030.10.31", "holding_type": "bond", "weight_pct": 2.5, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 6, "holding_name": "People's Republic of China 2.04% 2034.11.25", "holding_type": "bond", "weight_pct": 2.3, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 7, "holding_name": "Government of Japan 2.30% 2054.12.20", "holding_type": "bond", "weight_pct": 2.0, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 8, "holding_name": "Italy Buoni Poliennali Del Tesoro 4.30% 2054.10.01", "holding_type": "bond", "weight_pct": 1.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 9, "holding_name": "Secretaria General Del Tesoro 4.00% 2054.10.31", "holding_type": "bond", "weight_pct": 1.6, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根国际债", "fund_name": "摩根国际债", "rank": 10, "holding_name": "US Department of The Treasury 4.25% 2035.05.15", "holding_type": "bond", "weight_pct": 1.4, "as_of_date": "2025-11-30"},

    # ==========================================
    # 摩根亚洲总收益债券基金 (968000) 截至2025年11月底
    # ==========================================
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 1, "holding_name": "Her Majesty The Queen In Right of New Zealand 4.5% 2030.05.15", "holding_type": "bond", "weight_pct": 2.2, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 2, "holding_name": "US Department of The Treasury 1.875% 2035.07.15", "holding_type": "bond", "weight_pct": 1.2, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 3, "holding_name": "HDFC Bank Limited 3.7% 2075.11.30", "holding_type": "bond", "weight_pct": 1.0, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 4, "holding_name": "Krung Thai Bank Pcl 4.4% 2075.11.30", "holding_type": "bond", "weight_pct": 0.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 5, "holding_name": "Republic of The Philippines 5.95% 2047.10.13", "holding_type": "bond", "weight_pct": 0.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 6, "holding_name": "Meituan 0% 2028.04.27", "holding_type": "bond", "weight_pct": 0.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 7, "holding_name": "PT Bank Negara Indonesia 4.3% 2049.12.31", "holding_type": "bond", "weight_pct": 0.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 8, "holding_name": "PT Freeport Indonesia 5.315% 2032.04.14", "holding_type": "bond", "weight_pct": 0.8, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 9, "holding_name": "Tata Capital Ltd 5.389% 2028.07.21", "holding_type": "bond", "weight_pct": 0.7, "as_of_date": "2025-11-30"},
    {"sc_product_code": "摩根亚洲总收益", "fund_name": "摩根亚洲总收益", "rank": 10, "holding_name": "Studio City Finance Limited 5% 2029.01.15", "holding_type": "bond", "weight_pct": 0.7, "as_of_date": "2025-11-30"},
]

# 先删除这 3 只基金的旧数据
for code in ["施罗德亚洲高息股债基金M类别(人民币派息)", "摩根国际债", "摩根亚洲总收益"]:
    sb.table("mrf_holdings").delete().eq("fund_name", code).execute()
    print(f"已清除旧数据: {code}")

# 批量插入
resp = sb.table("mrf_holdings").insert(holdings).execute()
print(f"✅ 插入完成: {len(holdings)} 条")

# 验证
result = (
    sb.table("mrf_holdings")
    .select("fund_name, rank, holding_name, weight_pct")
    .in_("fund_name", ["施罗德亚洲高息股债基金M类别(人民币派息)", "摩根国际债", "摩根亚洲总收益"])
    .order("fund_name")
    .order("rank")
    .execute()
)
print(f"\n验证结果: {len(result.data)} 条")
for r in result.data:
    print(f"  {r['fund_name'][:10]} #{r['rank']} {r['holding_name'][:30]} {r['weight_pct']}%")
