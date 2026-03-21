# -*- coding: utf-8 -*-
"""
将「摩根亚洲总收益」基金 Top 10 债券持仓写入 Supabase mrf_holdings。
数据来源：基金报告截图（十大投资项目，截至2025年11月底）。

在项目根目录执行：py scripts/insert_jpm_asia_total_return_holdings.py
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


# 与 mrf_funds 表一致；报告截图基金代码 968000（PRC人民币对冲份额(累计)）
FUND_NAME = "摩根亚洲总收益"
SC_PRODUCT_CODE = "968000"
AS_OF_DATE = "2025-11-30"  # 截至2025年11月底

# 十大投资项目（债券），摘自报告「投资项目 (截至2025年11月底)」
ROWS = [
    {"rank": 1, "holding_name": "Her Majesty The Queen In Right of New Zealand 4.5% 15/05/30", "holding_type": "bond", "weight_pct": 2.2},
    {"rank": 2, "holding_name": "Us Department of The Treasury 1.875% 15/07/35", "holding_type": "bond", "weight_pct": 1.2},
    {"rank": 3, "holding_name": "Hdfc Bank Limited 3.7% 30/11/75", "holding_type": "bond", "weight_pct": 1.0},
    {"rank": 4, "holding_name": "Krung Thai Bank Pcl/Cayman Islands 4.4% 30/11/75", "holding_type": "bond", "weight_pct": 0.8},
    {"rank": 5, "holding_name": "Republic of The Philippines 5.95% 13/10/47", "holding_type": "bond", "weight_pct": 0.8},
    {"rank": 6, "holding_name": "Meituan 0% 27/04/28", "holding_type": "bond", "weight_pct": 0.8},
    {"rank": 7, "holding_name": "Pt Bank Negara Indonesia (Persero) Tbk 4.3% 31/12/49", "holding_type": "bond", "weight_pct": 0.8},
    {"rank": 8, "holding_name": "Pt Freeport Indonesia 5.315% 14/04/32", "holding_type": "bond", "weight_pct": 0.8},
    {"rank": 9, "holding_name": "Tata Capital Ltd 5.389% 21/07/28", "holding_type": "bond", "weight_pct": 0.7},
    {"rank": 10, "holding_name": "Studio City Finance Limited 5% 15/01/29", "holding_type": "bond", "weight_pct": 0.7},
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

    print("已写入摩根亚洲总收益（%s）共 %d 条债券持仓，as_of_date=%s" % (SC_PRODUCT_CODE, len(ROWS), AS_OF_DATE))


if __name__ == "__main__":
    main()
