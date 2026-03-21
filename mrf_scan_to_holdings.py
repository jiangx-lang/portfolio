# -*- coding: utf-8 -*-
"""
将 onepage 下全部 MRF 基金的 Top 10 持仓解析出来，写入固定存储位置。

存储位置：
  1. 本地 CSV：data/mrf_top10_holdings.csv（默认）
  2. Supabase 表：mrf_holdings（加 --supabase 且配置环境变量后）

用法：
  py mrf_scan_to_holdings.py              # 扫描 onepage 全部 PDF → data/mrf_top10_holdings.csv
  py mrf_scan_to_holdings.py --csv out.csv # 指定 CSV 路径
  py mrf_scan_to_holdings.py --supabase   # 同时写入 Supabase mrf_holdings（会先删除本次涉及基金的旧数据再插入）
"""
import os
import re
import sys
import csv
from pathlib import Path
from datetime import date

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent


def _load_env_file(path: Path) -> bool:
    """从指定 .env 文件加载环境变量，不覆盖已存在的。返回是否成功读取文件。"""
    if not path.exists():
        return False
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            key = k.strip()
            val = v.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    return True


# 依次尝试（先加载的优先，不覆盖）：项目根 .env → mf-holdings-dashboard/.env.local → .env
for _env_name in [".env", "mf-holdings-dashboard/.env.local", "mf-holdings-dashboard/.env"]:
    _load_env_file(PROJECT_ROOT / _env_name.replace("/", os.sep))

ONEPAGE = PROJECT_ROOT / "onepage"
if not ONEPAGE.exists():
    ONEPAGE = Path(r"D:\portoflio for mrf\onepage")

# 默认存储位置：项目 data 目录下
DEFAULT_CSV_PATH = PROJECT_ROOT / "data" / "mrf_top10_holdings.csv"

# PDF 解析出的基金名（原始或清洗后）→ mrf_funds.fund_name（规范名称，写入 Supabase 用）
# 带后缀的 PDF 文件名由 clean_fund_name 先清洗再查表
MRF_NAME_TO_CODE = {
    # 东方汇理（短横线变体）
    "东方汇理香港组合 – 灵活配置增长":   "东方汇理香港组合-灵活配置增长",
    "东方汇理香港组合-灵活配置增长":      "东方汇理香港组合-灵活配置增长",
    "东方汇理香港组合 – 灵活配置均衡":   "东方汇理香港组合-灵活配置均衡",
    "东方汇理香港组合-灵活配置均衡":      "东方汇理香港组合-灵活配置均衡",
    "东方汇理香港组合 – 灵活配置平稳":   "东方汇理香港组合-灵活配置平稳",
    "东方汇理香港组合-灵活配置平稳":      "东方汇理香港组合-灵活配置平稳",

    # 东亚联丰（PDF 文件名带"每月基金报告..."，清洗后匹配）
    "东亚联丰环球股票基金":               "东亚联丰环球股票基金",
    "东亚联丰亚洲债券及货币基金":          "东亚联丰亚洲债券及货币基金",

    # 惠理（PDF 文件名带"P类每月基金报告..."）
    "惠理高息股票基金":                   "惠理高息股票基金",
    "惠理价值基金":                       "惠理价值基金",

    # 摩根（名称已干净）
    "摩根国际债":                         "摩根国际债",
    "摩根太平洋科技":                     "摩根太平洋科技",
    "摩根太平洋证券":                     "摩根太平洋证券",
    "摩根亚洲股息":                       "摩根亚洲股息",
    "摩根亚洲总收益":                     "摩根亚洲总收益",

    # 瑞士百达（PDF 文件名带"-HM人民币每月..."）
    "瑞士百达策略收益基金":               "瑞士百达策略收益基金",

    # 中银（名称已干净）
    "中银香港环球股票基金":               "中银香港环球股票基金",
    "中银香港香港股票基金":               "中银香港香港股票基金",
}


def clean_fund_name(raw: str) -> str:
    """去掉 PDF 解析出的多余后缀（每月基金报告、P/M类、HM人民币、年份括号等）。"""
    name = re.sub(r'[-–]?\s*HM人民币.*$', '', raw)
    name = re.sub(r'每月基金报告.*$', '', name)
    name = re.sub(r'[PM]类每月.*$', '', name)
    name = re.sub(r'[PM]类.*报告.*$', '', name)
    name = re.sub(r'（\d{4}.*）', '', name)
    name = re.sub(r'\(\d{4}.*\)', '', name)
    name = name.strip().rstrip('-–').strip()
    return name


def _get_supabase():
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = (
            os.environ.get("SUPABASE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        )
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def main():
    from fund_factory import get_parser_for_file, parse_fund_pdf

    pdfs = sorted(
        [p for p in ONEPAGE.glob("*.pdf") if get_parser_for_file(p) is not None],
        key=lambda p: p.name,
    )
    if not pdfs:
        print("onepage 下无已支持解析的 PDF。")
        return

    rows = []
    for path in pdfs:
        try:
            data = parse_fund_pdf(path)
        except Exception as e:
            print("跳过 %s: %s" % (path.name, e))
            continue
        # 规范基金名：原始名 → 映射表 → 清洗后名，写入时用规范名作为 fund_name 和 sc_product_code
        raw_name = data.fund_name.strip()
        cleaned = clean_fund_name(raw_name)
        code = (
            MRF_NAME_TO_CODE.get(raw_name)
            or MRF_NAME_TO_CODE.get(cleaned)
            or cleaned
        )
        as_of = date.today().isoformat()  # 解析器若未提供日期可改为固定或从 PDF 元数据取
        # 股票持仓
        equity_holdings = getattr(data, "top_10_holdings", None) or []
        bond_holdings = getattr(data, "top_10_bond_holdings", None) or []
        if not equity_holdings and not bond_holdings:
            other = getattr(data, "holdings", None) or []
            if other:
                bond_holdings = other[:10]
        for i, h in enumerate(equity_holdings):
            rows.append({
                "fund_name": code,
                "sc_product_code": code,
                "rank": getattr(h, "rank", i + 1),
                "holding_name": getattr(h, "name", str(h)),
                "holding_type": "equity",
                "weight_pct": round(getattr(h, "weight", 0), 2),
                "as_of_date": as_of,
            })
        # 债券持仓（rank 接在股票之后）
        for i, h in enumerate(bond_holdings):
            rows.append({
                "fund_name": code,
                "sc_product_code": code,
                "rank": getattr(h, "rank", len(equity_holdings) + i + 1),
                "holding_name": getattr(h, "name", str(h)),
                "holding_type": "bond",
                "weight_pct": round(getattr(h, "weight", 0), 2),
                "as_of_date": as_of,
            })

    if not rows:
        print("未解析出任何持仓。")
        return

    # 存储位置 1：本地 CSV
    out_csv = DEFAULT_CSV_PATH
    if "--csv" in sys.argv:
        idx = sys.argv.index("--csv")
        out_csv = Path(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else out_csv
    else:
        out_csv.parent.mkdir(parents=True, exist_ok=True)

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["fund_name", "sc_product_code", "rank", "holding_name", "holding_type", "weight_pct", "as_of_date"])
        w.writeheader()
        w.writerows(rows)
    print("已写入 CSV: %s（共 %d 条）" % (out_csv, len(rows)))

    # 存储位置 2：Supabase mrf_holdings（可选）
    if "--supabase" not in sys.argv:
        return

    sb = _get_supabase()
    if not sb:
        print("未配置 SUPABASE_URL/SUPABASE_KEY，跳过 Supabase 写入。")
        print("  脚本会从以下位置读取（任选其一）：")
        print("    - 项目根目录 .env")
        print("    - mf-holdings-dashboard/.env.local")
        print("  请在其中设置 SUPABASE_URL 和 SUPABASE_KEY 后重新执行。")
        return

    codes_in_this_run = list({r["sc_product_code"] for r in rows})
    for code in codes_in_this_run:
        try:
            sb.table("mrf_holdings").delete().eq("sc_product_code", code).execute()
        except Exception as e:
            print("删除旧数据 %s: %s" % (code, e))

    for r in rows:
        try:
            sb.table("mrf_holdings").insert({
                "sc_product_code": r["sc_product_code"],
                "fund_name": r["fund_name"],
                "rank": r["rank"],
                "holding_name": r["holding_name"],
                "holding_type": r["holding_type"],
                "weight_pct": r["weight_pct"],
                "as_of_date": r["as_of_date"],
            }).execute()
        except Exception as e:
            print("插入失败 %s: %s" % (r.get("holding_name"), e))
    print("已写入 Supabase mrf_holdings（共 %d 条，%d 只基金）。" % (len(rows), len(codes_in_this_run)))


if __name__ == "__main__":
    main()
