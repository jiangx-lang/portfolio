# -*- coding: utf-8 -*-
"""
将「施罗德亚洲高息股债」基金 Top 10 持仓写入 Supabase mrf_holdings。
数据来源：晨星报告截图（前五大股票 + 前五大债券），基金代号 968013，截至 2024-11-25。

在项目根目录执行：py scripts/insert_schroders_968166_holdings.py
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


# 与 mrf_funds 表一致（施罗德亚洲高息股债基金M类别(人民币派息)）
# 报告截图显示基金代号 968013，本份额表现自 2024-11-25 起计算
FUND_NAME = "施罗德亚洲高息股债基金M类别(人民币派息)"
SC_PRODUCT_CODE = "968013"
AS_OF_DATE = "2024-11-25"

ROWS = [
    # Top 5 股票 (rank 1-5)
    {"rank": 1, "holding_name": "台积电 (TSMC)", "holding_type": "equity", "weight_pct": 2.29},
    {"rank": 2, "holding_name": "CHINA CONSTRUCTION BANK CORP H", "holding_type": "equity", "weight_pct": 1.78},
    {"rank": 3, "holding_name": "HON HAI PRECISION INDUSTRY LTD", "holding_type": "equity", "weight_pct": 1.69},
    {"rank": 4, "holding_name": "DBS GROUP HOLDINGS LTD", "holding_type": "equity", "weight_pct": 1.59},
    {"rank": 5, "holding_name": "联发科技 (MediaTek)", "holding_type": "equity", "weight_pct": 1.34},
    # Top 5 债券 (rank 6-10)
    {"rank": 6, "holding_name": "WOORI BANK AT1-P 6.375 31-DEC-2079 Reg-S (SUB)", "holding_type": "bond", "weight_pct": 0.74},
    {"rank": 7, "holding_name": "SUMITOMO LIFE INSURANCE CO PERP 5.875 31-DEC-2079 Reg-S (SUB)", "holding_type": "bond", "weight_pct": 0.71},
    {"rank": 8, "holding_name": "BANK NEGARA INDONESIA PERSERO TBK AT1-P 4.3 31-DEC-2079 Reg-S (CAPSEC (BTP))", "holding_type": "bond", "weight_pct": 0.70},
    {"rank": 9, "holding_name": "MEIJI YASUDA LIFE INSURANCE CO HYBRID 5.8 11-SEP-2054 Reg-S (SUB)", "holding_type": "bond", "weight_pct": 0.70},
    {"rank": 10, "holding_name": "WYNN MACAU LTD 5.5 01-OCT-2027 Reg-S (SENIOR)", "holding_type": "bond", "weight_pct": 0.57},
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

    # 先删除该基金已有持仓（含旧代码 968166），再插入
    for old_code in ("968166", SC_PRODUCT_CODE):
        try:
            sb.table("mrf_holdings").delete().eq("sc_product_code", old_code).execute()
            print("已删除旧数据: sc_product_code = %s" % old_code)
        except Exception as e:
            print("删除旧数据 %s 时: %s" % (old_code, e))

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
            print("插入失败 %s: %s" % (r["holding_name"][:30], e))

    print("已写入施罗德亚洲高息股债（%s）共 %d 条持仓，as_of_date=%s" % (SC_PRODUCT_CODE, len(ROWS), AS_OF_DATE))


if __name__ == "__main__":
    main()
