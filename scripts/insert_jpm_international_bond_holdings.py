# -*- coding: utf-8 -*-
"""
将「摩根国际债」基金 Top 10 债券持仓写入 Supabase mrf_holdings。
数据来源：基金报告截图（十大投资项目，截至2025年11月底）。

在项目根目录执行：py scripts/insert_jpm_international_bond_holdings.py
"""
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)


def _load_env(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            key, val = k.strip(), v.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


for name in [".env", "mf-holdings-dashboard/.env.local", "mf-holdings-dashboard/.env"]:
    _load_env(PROJECT_ROOT / name.replace("/", os.sep))


# 与 mrf_funds 表一致；报告截图基金代码 968050（PRC人民币对冲份额累计）等
FUND_NAME = "摩根国际债"
SC_PRODUCT_CODE = "968050"
AS_OF_DATE = "2025-11-30"  # 截至2025年11月底

# 十大投资项目（债券），摘自报告「截至2025年11月底」
ROWS = [
    {"rank": 1, "holding_name": "Us Department of The Treasury 3.88% 30/06/30 3.880%", "holding_type": "bond", "weight_pct": 5.8},
    {"rank": 2, "holding_name": "United Kingdom of Great Britain And Northern Ireland 4.50% 07/03/35", "holding_type": "bond", "weight_pct": 5.7},
    {"rank": 3, "holding_name": "Republic of Italy 3.65% 01/08/35", "holding_type": "bond", "weight_pct": 4.3},
    {"rank": 4, "holding_name": "French Republic 3.50% 25/11/35", "holding_type": "bond", "weight_pct": 2.8},
    {"rank": 5, "holding_name": "Us Department of The Treasury 3.63% 31/10/30 3.630%", "holding_type": "bond", "weight_pct": 2.5},
    {"rank": 6, "holding_name": "People's Republic of China 2.04% 25/11/34", "holding_type": "bond", "weight_pct": 2.3},
    {"rank": 7, "holding_name": "Government of Japan 2.30% 20/12/54", "holding_type": "bond", "weight_pct": 2.0},
    {"rank": 8, "holding_name": "Italy Buoni Poliennali Del Tesoro 4.30% 01/10/54", "holding_type": "bond", "weight_pct": 1.8},
    {"rank": 9, "holding_name": "Secretaria General Del Tesoro Y Financiacion Internacional 4.00% 31/10/54", "holding_type": "bond", "weight_pct": 1.6},
    {"rank": 10, "holding_name": "Us Department of The Treasury 4.25% 15/05/35 4.250%", "holding_type": "bond", "weight_pct": 1.4},
]


def main():
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        print("未配置 SUPABASE_URL / SUPABASE_KEY（或 NEXT_PUBLIC_*）。请在 .env 或 mf-holdings-dashboard/.env.local 中设置。")
        sys.exit(1)

    sb = create_client(url, key)

    try:
        sb.table("mrf_holdings").delete().eq("sc_product_code", SC_PRODUCT_CODE).execute()
        print("已删除旧数据: sc_product_code = %s" % SC_PRODUCT_CODE)
    except Exception as e:
        print("删除旧数据时: %s" % e)

    for r in ROWS:
        row = {
            "sc_product_code": SC_PRODUCT_CODE,
            "fund_name": FUND_NAME,
            "rank": r["rank"],
            "holding_name": r["holding_name"],
            "holding_type": r["holding_type"],
            "weight_pct": r["weight_pct"],
            "as_of_date": AS_OF_DATE,
        }
        try:
            sb.table("mrf_holdings").insert(row).execute()
        except Exception as e:
            print("插入失败 %s: %s" % (r["holding_name"][:40], e))

    print("已写入摩根国际债（%s）共 %d 条债券持仓，as_of_date=%s" % (SC_PRODUCT_CODE, len(ROWS), AS_OF_DATE))


if __name__ == "__main__":
    main()
