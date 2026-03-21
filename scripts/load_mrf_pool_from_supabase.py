# -*- coding: utf-8 -*-
"""
从 Supabase mrf_funds 表加载 MRF_POOL 格式的字典。
供 app.py 调用；也可单独运行测试：python scripts/load_mrf_pool_from_supabase.py
"""
import os
from pathlib import Path

# 加载 .env（若存在）
_root = Path(__file__).resolve().parent.parent
_env = _root / ".env"
if _env.exists():
    for line in _env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def _get_supabase_credentials():
    """优先环境变量，其次 Streamlit secrets（当在 Streamlit 中运行时）。"""
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()
    if not url or not key:
        try:
            import streamlit as st
            secrets = getattr(st, "secrets", None) or {}
            if isinstance(secrets, dict):
                url = (secrets.get("SUPABASE_URL") or secrets.get("supabase", {}).get("SUPABASE_URL") or "").strip()
                key = (secrets.get("SUPABASE_KEY") or secrets.get("supabase", {}).get("SUPABASE_KEY") or "").strip()
        except Exception:
            pass
    return url, key


def load_mrf_pool_from_supabase():
    """
    从 Supabase mrf_funds 表读取基金池。
    返回与 app.py MRF_POOL 同结构的 dict，失败返回 None。
    """
    url, key = _get_supabase_credentials()
    if not url or not key:
        return None
    try:
        from supabase import create_client
        client = create_client(url, key)
        r = client.table("mrf_funds").select("fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate").execute()
        if not r.data or len(r.data) == 0:
            return None
        pool = {}
        for row in r.data:
            name = row.get("fund_name")
            if not name:
                continue
            pool[name] = {
                "brand": row.get("brand") or "",
                "股票": int(row.get("equity_pct") or 0),
                "固定收益": int(row.get("fixed_income_pct") or 0),
                "现金": int(row.get("cash_pct") or 0),
                "fee_rate": float(row.get("fee_rate") or 0),
            }
        return pool if pool else None
    except Exception:
        return None


if __name__ == "__main__":
    pool = load_mrf_pool_from_supabase()
    if pool:
        print(f"Loaded {len(pool)} funds from Supabase")
        for name, d in list(pool.items())[:3]:
            print(f"  {name}: {d}")
    else:
        print("No data (Supabase not configured or mrf_funds empty)")
