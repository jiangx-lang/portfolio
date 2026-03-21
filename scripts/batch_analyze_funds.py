# -*- coding: utf-8 -*-
"""
批量生成基金 AI 分析并写入 Supabase fund_ai_analysis。

运行（项目根目录）：
  py scripts/batch_analyze_funds.py
"""

import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from supabase import create_client


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_env_file(path: Path) -> bool:
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


def load_env() -> None:
    # 先加载 Groq key（可能在 mf-holdings-dashboard/.env.local）
    for p in [
        PROJECT_ROOT / "mf-holdings-dashboard" / ".env.local",
        PROJECT_ROOT / "mf-holdings-dashboard" / ".env",
        PROJECT_ROOT / ".env",
        PROJECT_ROOT / "qdii_portfolio" / ".env",
    ]:
        _load_env_file(p)


def call_groq(prompt: str, groq_api_key: str) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {
                "role": "system",
                "content": "你是专业的香港互认基金/基金投资顾问。用中文回答。只返回JSON，不要任何markdown或解释。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 800,
        "response_format": {"type": "json_object"},
    }
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=body,
        timeout=60,
    )
    r.raise_for_status()
    j = r.json()
    content = j["choices"][0]["message"]["content"]
    return json.loads(content)


def analyze_mrf_fund(fund: Dict[str, Any], groq_api_key: str) -> Dict[str, Any]:
    equity = int(fund.get("equity_pct") or 0)
    risk = "进取型" if equity >= 80 else "均衡型" if equity >= 40 else "稳健型"
    prompt = f"""分析这只MRF基金：
基金名称：{fund.get('fund_name')}
品牌：{fund.get('brand')}
资产配置：股票{fund.get('equity_pct')}% / 固定收益{fund.get('fixed_income_pct')}% / 现金{fund.get('cash_pct')}%
申购费率：{fund.get('fee_rate')}%
风险类型：{risk}

返回JSON：
{{
  "signal": "strong_buy" | "buy" | "hold" | "trim" | "sell",
  "confidence": 0-100,
  "summary": "一句话总结",
  "thesis": "投资逻辑2-3句",
  "strengths": ["优势1","优势2","优势3"],
  "risks": ["风险1","风险2"],
  "fee_assessment": "费率评价",
  "suitable_investor": "适合投资者类型",
  "allocation_comment": "配置点评",
  "recommendation": "具体建议"
}}"""
    return call_groq(prompt, groq_api_key)


def analyze_qd_fund(
    fund_name_cn: str, primary_code: str, holdings: List[Dict[str, Any]], groq_api_key: str
) -> Dict[str, Any]:
    top5 = [str(h.get("holding_name_std") or "") for h in holdings[:5] if (h.get("holding_name_std") or "")]
    prompt = f"""分析这只QDII基金：
基金名称：{fund_name_cn}
产品代码：{primary_code}
Top5持仓：{', '.join(top5)}

返回JSON：
{{
  "signal": "strong_buy" | "buy" | "hold" | "trim" | "sell",
  "confidence": 0-100,
  "summary": "一句话总结",
  "thesis": "投资逻辑2-3句",
  "strengths": ["优势1","优势2","优势3"],
  "risks": ["风险1","风险2"],
  "fee_assessment": "暂无费率数据",
  "suitable_investor": "适合投资者类型",
  "allocation_comment": "持仓点评",
  "recommendation": "具体建议"
}}"""
    return call_groq(prompt, groq_api_key)


def upsert_analysis(
    sb,
    fund_code: str,
    fund_type: str,
    fund_name: str,
    result: Dict[str, Any],
) -> None:
    sb.table("fund_ai_analysis").upsert(
        {
            "fund_code": fund_code,
            "fund_type": fund_type,
            "fund_name": fund_name,
            "signal": result.get("signal", "hold"),
            "confidence": int(result.get("confidence", 50) or 50),
            "summary": result.get("summary", "") or "",
            "thesis": result.get("thesis", "") or "",
            "strengths": result.get("strengths", []) or [],
            "risks": result.get("risks", []) or [],
            "fee_assessment": result.get("fee_assessment", "") or "",
            "suitable_investor": result.get("suitable_investor", "") or "",
            "allocation_comment": result.get("allocation_comment", "") or "",
            "recommendation": result.get("recommendation", "") or "",
        },
        on_conflict="fund_code,fund_type",
    ).execute()


def main() -> None:
    load_env()

    groq_api_key = os.environ.get("GROQ_API_KEY") or ""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not groq_api_key:
        raise RuntimeError("缺少 GROQ_API_KEY（请在 mf-holdings-dashboard/.env.local 或 .env 配置）")
    if not supabase_url or not supabase_key:
        raise RuntimeError("缺少 SUPABASE_URL / SUPABASE_KEY")

    sb = create_client(supabase_url, supabase_key)

    print("=== 分析 MRF 基金 ===")
    mrf_resp = sb.table("mrf_funds").select("*").execute()
    for fund in mrf_resp.data or []:
        name = str(fund.get("fund_name") or "").strip()
        if not name:
            continue
        print(f"分析 MRF: {name} ...")
        try:
            result = analyze_mrf_fund(fund, groq_api_key)
            upsert_analysis(sb, name, "MRF", name, result)
            print(f"  ✅ {result.get('signal')} {result.get('confidence')}%")
        except Exception as e:
            print(f"  ❌ {e}")
        time.sleep(2)

    print("\n=== 分析 QD 基金 ===")
    db_path = PROJECT_ROOT / "qdii_portfolio" / "fund_tagging.db"
    conn = sqlite3.connect(str(db_path))
    funds = conn.execute(
        """
        SELECT DISTINCT fund_id, fund_name_cn, primary_code
        FROM fund_holding_exposure
        WHERE primary_code IS NOT NULL AND fund_name_cn IS NOT NULL
        ORDER BY fund_name_cn
        """
    ).fetchall()

    for fund_id, fund_name_cn, primary_code in funds:
        fund_name_cn = str(fund_name_cn)
        primary_code = str(primary_code)
        rows = conn.execute(
            """
            SELECT holding_name_std, weight_pct, holding_type
            FROM fund_holding_exposure
            WHERE fund_id = ? ORDER BY CAST(rank AS INTEGER) ASC LIMIT 10
            """,
            (fund_id,),
        ).fetchall()
        holdings = [
            {"holding_name_std": r[0], "weight_pct": r[1], "holding_type": r[2]} for r in rows
        ]
        print(f"分析 QD: {fund_name_cn} ({primary_code}) ...")
        try:
            result = analyze_qd_fund(fund_name_cn, primary_code, holdings, groq_api_key)
            upsert_analysis(sb, primary_code, "QD", fund_name_cn, result)
            print(f"  ✅ {result.get('signal')} {result.get('confidence')}%")
        except Exception as e:
            print(f"  ❌ {e}")
        time.sleep(2)

    conn.close()
    print("\n✅ 批量分析完成！")


if __name__ == "__main__":
    main()

