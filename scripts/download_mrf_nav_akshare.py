# -*- coding: utf-8 -*-
"""
MRF 净值下载：用 AKShare 拉取香港 968 基金历史净值，导出为 data/nav/{基金名}.csv。
- 数据范围：过去 5 年（可按需改 YEARS_BACK）。
- 输出格式：csvdate,nav，UTF-8，文件名与 app.py MRF_POOL 的 key 完全一致。
- 依赖：pip install akshare pandas
"""
from __future__ import annotations

import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

# 与 app.py MRF_POOL 的 key 保持一致（用于匹配 akshare 基金简称并作为输出文件名）
MRF_DISPLAY_NAMES = [
    "东方汇理香港组合-灵活配置增长",
    "东方汇理香港组合-灵活配置均衡",
    "东方汇理香港组合-灵活配置平稳",
    "东亚联丰环球股票基金",
    "东亚联丰亚洲债券及货币基金",
    "惠理高息股票基金",
    "惠理价值基金",
    "摩根国际债",
    "摩根太平洋科技",
    "摩根太平洋证券",
    "摩根亚洲股息",
    "摩根亚洲总收益",
    "瑞士百达策略收益基金",
    "中银香港环球股票基金",
    "中银香港香港股票基金",
    "施罗德亚洲高息股债基金M类别(人民币派息)",
]

# 可选：显式映射 基金代码(968xxx) → MRF_POOL key。若存在 scripts/mrf_akshare_mapping.csv 则优先使用
# CSV 格式：基金代码,display_name  或  基金简称,display_name
MAPPING_CSV = Path(__file__).resolve().parent / "mrf_akshare_mapping.csv"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "nav"
YEARS_BACK = 5


def _normalize_date(s) -> str | None:
    """统一为 YYYY-MM-DD。"""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    s = str(s).strip()
    if not s or s.lower() == "nan":
        return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    if len(s) >= 8 and s[:8].isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return s[:10] if len(s) >= 10 else None


def _normalize_name(s: str) -> str:
    """去掉空格、横线，便于匹配。"""
    if not s or not isinstance(s, str):
        return ""
    return re.sub(r"[\s\-]+", "", s)


def build_code_to_display_mapping(rank_df: pd.DataFrame) -> dict[str, str]:
    """
    建立 基金代码(968xxx) → MRF_POOL display_name 的映射。
    优先读 MAPPING_CSV；否则用 基金简称 与 MRF_DISPLAY_NAMES 模糊匹配。
    """
    code_col = "基金代码"
    name_col = "基金简称"
    rank_df = rank_df.copy()
    rank_df[code_col] = rank_df[code_col].astype(str).str.strip()
    hk_col = [c for c in rank_df.columns if "香港" in str(c)]
    if not hk_col:
        return {}
    hk_col = hk_col[0]

    mapping: dict[str, str] = {}

    # 1. 显式映射文件
    if MAPPING_CSV.exists():
        try:
            mdf = pd.read_csv(MAPPING_CSV, encoding="utf-8", header=None)
            if mdf.shape[1] >= 2:
                for _, row in mdf.iterrows():
                    key = str(row.iloc[0]).strip()
                    disp = str(row.iloc[1]).strip()
                    if not key or not disp:
                        continue
                    # 若 key 是 968 代码，直接记
                    if key.isdigit() and key.startswith("968"):
                        mapping[key] = disp
                    else:
                        # 否则当作 基金简称，后面按简称匹配时覆盖
                        for _, r in rank_df.iterrows():
                            if _normalize_name(str(r.get(name_col, ""))) == _normalize_name(key):
                                mapping[str(r[code_col])] = disp
                                break
        except Exception as e:
            print(f"  读取映射文件失败: {e}")

    # 2. 对未映射的 968，用 基金简称 与 MRF_DISPLAY_NAMES 匹配
    for _, row in rank_df.iterrows():
        code = str(row[code_col]).strip()
        if not code.startswith("968"):
            continue
        if code in mapping:
            continue
        short_name = str(row.get(name_col, "") or "").strip()
        sn_norm = _normalize_name(short_name)
        for disp in MRF_DISPLAY_NAMES:
            if disp in mapping.values():
                continue
            dn_norm = _normalize_name(disp)
            # 显示名在简称里，或简称在显示名里（避免多对一：东方汇理三只靠 增长/均衡/平稳 区分）
            if dn_norm in sn_norm or sn_norm in dn_norm:
                # 东方汇理三只必须含 增长/均衡/平稳
                if "东方汇理" in disp:
                    if "增长" in disp and "增长" not in short_name:
                        continue
                    if "均衡" in disp and "均衡" not in short_name:
                        continue
                    if "平稳" in disp and "平稳" not in short_name:
                        continue
                mapping[code] = disp
                break

    return mapping


def main():
    try:
        import akshare as ak
    except ImportError:
        print("请先安装: pip install akshare")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=YEARS_BACK * 365)
    start_str = start_date.strftime("%Y-%m-%d")
    today_str = end_date.strftime("%Y-%m-%d")
    print(f"MRF NAV 下载（过去 {YEARS_BACK} 年） → {OUTPUT_DIR}")
    print(f"日期范围: {start_str} ~ {today_str}")
    print()

    # 1. 香港基金排行，筛 968
    print("获取香港基金列表 (fund_hk_rank_em)...")
    rank = ak.fund_hk_rank_em()
    if rank is None or rank.empty:
        print("fund_hk_rank_em 返回为空")
        return
    hk_code_col = [c for c in rank.columns if "香港" in str(c)]
    if not hk_code_col:
        print("未找到香港基金代码列")
        return
    hk_code_col = hk_code_col[0]
    rank["基金代码"] = rank["基金代码"].astype(str)
    mrf = rank[rank["基金代码"].str.startswith("968")].drop_duplicates(subset=["基金代码"], keep="first")
    if mrf.empty:
        print("无 968 系列基金")
        return

    code_to_display = build_code_to_display_mapping(rank)
    # 只处理我们需要的 display_name 对应的 968
    display_to_code: dict[str, str] = {}
    for code, disp in code_to_display.items():
        display_to_code[disp] = code
    matched = set(display_to_code.values())
    mrf = mrf[mrf["基金代码"].isin(matched)]
    print(f"已匹配 MRF_POOL: {len(display_to_code)} 只")
    for disp in MRF_DISPLAY_NAMES:
        if disp not in display_to_code:
            print(f"  未匹配: {disp}")
    print()

    n = len(mrf)
    written = 0
    for idx, (_, row) in enumerate(mrf.iterrows()):
        code_968 = str(row["基金代码"]).strip()
        display_name = code_to_display.get(code_968)
        if not display_name:
            continue
        hk_code = str(row[hk_code_col]).strip()
        if not hk_code or hk_code == "nan":
            continue

        try:
            ndf = ak.fund_hk_fund_hist_em(code=hk_code, symbol="历史净值明细")
            time.sleep(0.35)
        except Exception as e:
            print(f"  [{display_name[:12]}...] 请求失败: {e}")
            continue

        if ndf is None or ndf.empty:
            continue

        date_col = [c for c in ndf.columns if "日期" in str(c) or "date" in str(c).lower()]
        nav_col = [c for c in ndf.columns if "净值" in str(c) and "单位" in str(c)]
        if not date_col:
            date_col = [ndf.columns[0]]
        if not nav_col:
            nav_col = [c for c in ndf.columns if "净值" in str(c)]
        if not nav_col and len(ndf.columns) > 1:
            nav_col = [ndf.columns[1]]

        rows = []
        for _, r in ndf.iterrows():
            d = r.get(date_col[0]) if date_col else None
            if pd.isna(d):
                continue
            d_str = _normalize_date(d) or str(d)[:10]
            if not d_str or d_str < start_str or d_str > today_str:
                continue
            val = r.get(nav_col[0]) if nav_col else None
            if pd.isna(val):
                continue
            try:
                v = float(val)
            except (TypeError, ValueError):
                continue
            rows.append({"csvdate": d_str, "nav": v})

        if not rows:
            print(f"  [{display_name[:14]}...] 无在期数据，跳过")
            continue

        df_out = pd.DataFrame(rows).drop_duplicates(subset=["csvdate"]).sort_values("csvdate").reset_index(drop=True)
        out_path = OUTPUT_DIR / f"{display_name}.csv"
        df_out.to_csv(out_path, index=False, encoding="utf-8", date_format="%Y-%m-%d")
        written += 1
        print(f"  [{idx+1}/{n}] {display_name[:18]}... → {out_path.name} ({len(df_out)} 条)")

    print()
    print(f"完成：共写入 {written} 个 CSV 到 {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
