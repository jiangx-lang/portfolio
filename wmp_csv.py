# -*- coding: utf-8 -*-
"""
渣打 WMP 净值历史 CSV 存储（兼容 GitHub Actions 自动提交与 Streamlit 热更新）
data/wmp_history.csv：追加写入，按 (date, product_code) 去重。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "wmp_history.csv"
COLUMNS = ["date", "product_code", "product_name", "risk_level", "term", "nav"]


def ensure_data_dir() -> None:
    """确保 data 目录存在（GitHub Actions 与本地均可用）。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_wmp_csv() -> pd.DataFrame:
    """读取 data/wmp_history.csv，若不存在或为空则返回空 DataFrame。"""
    ensure_data_dir()
    if not CSV_PATH.exists():
        return pd.DataFrame(columns=COLUMNS)
    try:
        df = pd.read_csv(CSV_PATH, dtype=str)
        df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
        df = df.dropna(subset=["nav"])
        df["date"] = df["date"].astype(str).str.strip()
        if df.empty:
            return pd.DataFrame(columns=COLUMNS)
        return df[COLUMNS] if all(c in df.columns for c in COLUMNS) else pd.DataFrame(columns=COLUMNS)
    except Exception:
        return pd.DataFrame(columns=COLUMNS)


def append_wmp_records(records: list[dict[str, Any]]) -> int:
    """
    将爬虫抓取记录追加到 data/wmp_history.csv，并按 (date, product_code) 去重（保留最后一条）。
    返回本次写入后新增的不重复行数（用于提示）。
    """
    if not records:
        return 0
    ensure_data_dir()
    existing = read_wmp_csv()
    new_df = pd.DataFrame([
        {
            "date": r["date"],
            "product_code": r["product_code"],
            "product_name": r.get("product_name") or "",
            "risk_level": r.get("risk_level") or "",
            "term": r.get("term") or "",
            "nav": r["nav"],
        }
        for r in records
    ])
    combined = pd.concat([existing, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=["date", "product_code"], keep="last")
    combined = combined.sort_values("date").reset_index(drop=True)
    count_before = len(existing)
    count_after = len(combined)
    combined.to_csv(CSV_PATH, index=False, encoding="utf-8")
    return count_after - count_before
