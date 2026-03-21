# scripts/load_mrf_pool_from_supabase.py
# 供 app.py 调用：优先从 Supabase mrf_funds 读取，返回与 MRF_POOL 兼容的 dict
# 失败时返回 None（app.py 自动回退到硬编码）

from __future__ import annotations
import os

def load_mrf_pool_from_supabase() -> dict | None:
    """
    从 Supabase mrf_funds 表读取，返回与 app.py MRF_POOL 完全兼容的 dict：
    {
      "基金名称": {
        "brand": "JPM",
        "股票": 95,
        "固定收益": 0,
        "现金": 5,
        "fee_rate": 2.5
      },
      ...
    }
    失败/未配置时返回 None，app.py 回退到硬编码 MRF_POOL。
    """
    url = os.environ.get("SUPABASE_URL") or _read_env_file("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or _read_env_file("SUPABASE_KEY")

    if not url or not key:
        print("[MRF] Supabase 未配置，使用硬编码 MRF_POOL")
        return None

    try:
        from supabase import create_client
        sb = create_client(url, key)
        resp = sb.table("mrf_funds").select(
            "fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate"
        ).execute()

        rows = resp.data
        if not rows:
            print("[MRF] Supabase mrf_funds 为空，使用硬编码 MRF_POOL")
            return None

        pool = {}
        for r in rows:
            pool[r["fund_name"]] = {
                "brand":    r["brand"],
                "股票":     int(r["equity_pct"]),
                "固定收益": int(r["fixed_income_pct"]),
                "现金":     int(r["cash_pct"]),
                "fee_rate": float(r["fee_rate"]),
            }

        print(f"[MRF] 从 Supabase 加载 {len(pool)} 只 MRF 基金")
        return pool

    except Exception as e:
        print(f"[MRF] Supabase 加载失败：{e}，使用硬编码 MRF_POOL")
        return None


def _read_env_file(key: str) -> str | None:
    """尝试从 qdii_portfolio/.env 读取单个变量（不依赖 python-dotenv）"""
    from pathlib import Path
    for env_path in [
        Path(__file__).parent.parent / "qdii_portfolio" / ".env",
        Path(__file__).parent.parent / ".env",
    ]:
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None
