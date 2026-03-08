# -*- coding: utf-8 -*-
"""
列出 AKShare 中所有 968 香港基金代码与简称，便于填写 mrf_akshare_mapping.csv。
运行: python scripts/list_968_funds.py
"""
from pathlib import Path

def main():
    try:
        import akshare as ak
    except ImportError:
        print("请先安装: pip install akshare")
        return

    rank = ak.fund_hk_rank_em()
    if rank is None or rank.empty:
        print("fund_hk_rank_em 返回为空")
        return
    rank["基金代码"] = rank["基金代码"].astype(str)
    mrf = rank[rank["基金代码"].str.startswith("968")].drop_duplicates(subset=["基金代码"], keep="first")
    hk_col = [c for c in rank.columns if "香港" in str(c)]
    name_col = "基金简称"
    cols = ["基金代码", name_col]
    if hk_col:
        cols.append(hk_col[0])
    print("968 基金列表（可复制到 mrf_akshare_mapping.csv 第二列填写 display_name）")
    print("CSV 格式: 基金代码,display_name   (display_name 需与 app.py MRF_POOL key 完全一致)")
    print("-" * 80)
    for _, row in mrf.iterrows():
        code = str(row["基金代码"]).strip()
        name = str(row.get(name_col, "") or "").strip()
        print(f"{code},{name}")
    mapping_path = Path(__file__).resolve().parent / "mrf_akshare_mapping.csv"
    print()
    print(f"将上述中需要的行整理为: 基金代码,display_name 保存到 {mapping_path.name} 即可覆盖自动匹配。")

if __name__ == "__main__":
    main()
