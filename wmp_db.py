# -*- coding: utf-8 -*-
"""
渣打 WMP 净值历史存储与年化收益率计算
数据源：data/wmp_history.csv（兼容 GitHub Actions 定时抓取 + 自动提交）。
时间序列回溯 T-1/T-7/T-30/T-90，假期/周末无抓取时顺延填充前一日的净值（bfill）。
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

from wmp_csv import append_wmp_records as _append_records
from wmp_csv import ensure_data_dir
from wmp_csv import read_wmp_csv


def get_connection():
    """保留接口兼容；实际已使用 CSV，无连接对象。"""
    return None


def init_db() -> None:
    """确保 data 目录存在（与 wmp_csv 一致）。"""
    ensure_data_dir()


def insert_nav_records(records: list[dict[str, Any]]) -> int:
    """
    将爬虫抓取到的记录追加到 data/wmp_history.csv，按 (date, product_code) 去重。
    records 每项需含: date (YYYY-MM-DD), product_code, product_name, risk_level, term, nav.
    """
    return _append_records(records)


def _nav_on_or_before(df_product: pd.DataFrame, target_date: str) -> float | None:
    """
    顺延填充：取该产品在 target_date 及之前最近一次有记录的净值。
    假期/周末无抓取时，自动用前一日的 nav，方便后续按日历日计算 T-1/T-7 等。
    """
    candidates = df_product[df_product["date"] <= target_date]
    if candidates.empty:
        return None
    last_row = candidates.sort_values("date", ascending=False).iloc[0]
    return float(last_row["nav"])


def get_wmp_display_data() -> pd.DataFrame:
    """
    从 data/wmp_history.csv 读取净值历史，计算每只产品的最新净值及 T-1/T-7/T-30/T-90 年化收益率。
    若历史不足则对应单元格为 "N/A"（防崩溃容错）。
    返回列：产品销售代码, 产品名称, 渣打产品风险评级, 投资期限, 最新净值,
           daily% 【年化】, 1W收益率% 【年化】, 1M收益率% 【年化】, 3M收益率% 【年化】
    """
    init_db()
    df_all = read_wmp_csv()
    if df_all.empty:
        return pd.DataFrame(columns=[
            "产品销售代码", "产品名称", "渣打产品风险评级", "投资期限", "最新净值",
            "daily% 【年化】", "1W收益率% 【年化】", "1M收益率% 【年化】", "3M收益率% 【年化】",
        ])

    dates_asc = sorted(df_all["date"].unique().tolist())
    t0_date = dates_asc[-1]

    t0_dt = datetime.strptime(t0_date, "%Y-%m-%d")
    target_1 = (t0_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    target_7 = (t0_dt - timedelta(days=7)).strftime("%Y-%m-%d")
    target_30 = (t0_dt - timedelta(days=30)).strftime("%Y-%m-%d")
    target_90 = (t0_dt - timedelta(days=90)).strftime("%Y-%m-%d")

    t0_rows = df_all[df_all["date"] == t0_date].drop_duplicates(subset=["product_code"], keep="first")
    rows_out = []

    for _, r in t0_rows.iterrows():
        code = r["product_code"]
        name = r["product_name"]
        risk = r["risk_level"]
        term = r["term"]
        nav_t0 = float(r["nav"])

        df_product = df_all[df_all["product_code"] == code]
        nav_1 = _nav_on_or_before(df_product, target_1)
        nav_7 = _nav_on_or_before(df_product, target_7)
        nav_30 = _nav_on_or_before(df_product, target_30)
        nav_90 = _nav_on_or_before(df_product, target_90)

        def annualized_daily(n0: float, n1: float | None) -> str:
            if n1 is None or n1 <= 0:
                return "N/A"
            pct = (n0 / n1 - 1) * 365
            return f"{pct:.2f}%"

        def annualized_1w(n0: float, n7: float | None) -> str:
            if n7 is None or n7 <= 0:
                return "N/A"
            pct = (n0 / n7 - 1) * (365 / 7)
            return f"{pct:.2f}%"

        def annualized_1m(n0: float, n30: float | None) -> str:
            if n30 is None or n30 <= 0:
                return "N/A"
            pct = (n0 / n30 - 1) * (365 / 30)
            return f"{pct:.2f}%"

        def annualized_3m(n0: float, n90: float | None) -> str:
            if n90 is None or n90 <= 0:
                return "N/A"
            pct = (n0 / n90 - 1) * (365 / 90)
            return f"{pct:.2f}%"

        rows_out.append({
            "产品销售代码": code,
            "产品名称": name,
            "渣打产品风险评级": risk,
            "投资期限": term,
            "最新净值": nav_t0,
            "daily% 【年化】": annualized_daily(nav_t0, nav_1),
            "1W收益率% 【年化】": annualized_1w(nav_t0, nav_7),
            "1M收益率% 【年化】": annualized_1m(nav_t0, nav_30),
            "3M收益率% 【年化】": annualized_3m(nav_t0, nav_90),
        })

    df_out = pd.DataFrame(rows_out)
    if df_out.empty:
        return df_out
    # 按最近1周收益率从高到低排序，N/A 排最后
    def _parse_1w(val):
        if val == "N/A" or not isinstance(val, str):
            return float("-inf")
        try:
            return float(str(val).replace("%", "").strip())
        except ValueError:
            return float("-inf")
    df_out["_sort_1w"] = df_out["1W收益率% 【年化】"].map(_parse_1w)
    df_out = df_out.sort_values("_sort_1w", ascending=False).drop(columns=["_sort_1w"]).reset_index(drop=True)
    return df_out


if __name__ == "__main__":
    init_db()
    print("Data dir ready. get_wmp_display_data() sample:")
    df = get_wmp_display_data()
    print(df.head() if len(df) else "No data.")
