#!/usr/bin/env python3
"""
Fetch PE/PB/Beta and optional options-chain IV + put/call volume ratio per ticker.
Routes by ticker suffix: HK → AkShare 估值 + yfinance；CN → AkShare A 股；KR → Naver 财经 HTML（_per/_pbr）+ yfinance
（AkShare 当前无韩股接口；PyKRX/KRX 在部分网络环境下不可用）；US/其他 → yfinance。
Usage:
  python fetch_market_data.py '<json array of {ticker, weight}>'
  python fetch_market_data.py @holdings.json   # 从 UTF-8 文件读取（推荐 Windows）
"""
from __future__ import annotations

import json
import math
import random
import sys
import time
from datetime import date
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent / ".market_cache"


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _ticker_cache_key(ticker: str) -> str:
    t = ticker.strip().upper()
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in t)


def _cache_path(ticker: str) -> Path:
    today = date.today().isoformat()
    return CACHE_DIR / f"{_ticker_cache_key(ticker)}_{today}.json"


def _get_cached(ticker: str) -> dict | None:
    p = _cache_path(ticker)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _set_cache(ticker: str, data: dict) -> None:
    _ensure_cache_dir()
    p = _cache_path(ticker)
    to_store = {k: v for k, v in data.items() if k != "weight"}
    try:
        p.write_text(json.dumps(to_store, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def _is_rate_limited_error(err_msg: str) -> bool:
    s = (err_msg or "").lower()
    return "429" in s or "too many requests" in s or "rate limit" in s or "rate limited" in s


def _is_clean_for_cache(row: dict) -> bool:
    """仅缓存干净结果：无 error，且结构有效。"""
    if not isinstance(row, dict):
        return False
    if row.get("error"):
        return False
    # 不强求 PE/PB：ETF、债券、亏损股等可能天然缺失估值字段，
    # 这属于有效业务数据，应允许缓存，避免每天重复请求。
    return True


def _safe_float(x) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def detect_market(ticker: str) -> str:
    """根据 ticker 后缀判断市场（与 yfinance 常见后缀对齐）"""
    t = ticker.upper().strip()
    if t.endswith(".HK"):
        return "hk"
    if t.endswith(".SZ") or t.endswith(".SS") or t.endswith(".SH"):
        return "cn"
    if t.endswith(".TW"):
        return "tw"
    if t.endswith(".KS") or t.endswith(".KQ"):
        return "kr"
    if t.endswith(".T") or t.endswith(".JP"):
        return "jp"
    if "." not in t:
        return "us"
    return "other"


def _options_chain_metrics(stock) -> tuple[float | None, float | None, str | None]:
    """成交量加权 IV；PCR 仅来自期权成交量（不做 beta 代理）。"""
    iv = None
    put_call_ratio = None
    pcr_source = None
    try:
        opts = getattr(stock, "options", None) or []
        if not opts:
            return iv, put_call_ratio, pcr_source
        nearest = opts[0]
        chain = stock.option_chain(nearest)
        calls = chain.calls
        puts = chain.puts

        cv = calls["volume"].fillna(0).sum() if hasattr(calls, "empty") and not calls.empty else 0
        pv = puts["volume"].fillna(0).sum() if hasattr(puts, "empty") and not puts.empty else 0

        if cv > 0 and pv >= 0:
            put_call_ratio = float(pv) / float(cv)
            pcr_source = "options_volume"

        def _wavg_iv(df) -> float | None:
            if df is None or getattr(df, "empty", True):
                return None
            ivs = df.get("impliedVolatility")
            vols = df.get("volume")
            if ivs is None or vols is None:
                return None
            num = 0.0
            den = 0.0
            for ivv, vv in zip(ivs.fillna(0), vols.fillna(0)):
                ivf = _safe_float(ivv)
                vf = _safe_float(vv) or 0.0
                if ivf is not None and vf > 0:
                    num += ivf * vf
                    den += vf
            return (num / den) if den > 0 else None

        call_iv = _wavg_iv(calls)
        put_iv = _wavg_iv(puts)
        if call_iv is not None and put_iv is not None:
            iv = (call_iv + put_iv) / 2.0
        elif call_iv is not None:
            iv = call_iv
        elif put_iv is not None:
            iv = put_iv
    except Exception:
        pass
    return iv, put_call_ratio, pcr_source


def _yf_info_and_options(ticker: str):
    import yfinance as yf

    stock = yf.Ticker(ticker)
    info = stock.info or {}
    iv, pcr, psrc = _options_chain_metrics(stock)
    return stock, info, iv, pcr, psrc


def _apply_beta_pcr_proxy(info: dict, put_call_ratio: float | None, pcr_source: str | None):
    beta = _safe_float(info.get("beta"))
    if put_call_ratio is None and beta is not None:
        put_call_ratio = round(min(2.5, max(0.35, 0.9 + 0.25 * min(abs(beta), 2.0))), 3)
        pcr_source = "beta_proxy"
    return put_call_ratio, pcr_source


def _data_quality(ticker: str, iv: float | None) -> str:
    if iv is not None:
        return "full"
    t = ticker.upper()
    if t.endswith(".HK") or ".KS" in t or ".T" in t or ".L" in t:
        return "insufficient_options"
    return "partial"


def _build_from_yf(
    ticker: str,
    weight: float,
    market_label: str,
    data_source: str,
    *,
    prefer_ak_pe_pb: dict | None = None,
) -> dict:
    """prefer_ak_pe_pb: 若提供且含 pe_ttm/pb，则覆盖 yfinance 同名字段（本土化估值）。"""
    try:
        import yfinance as yf
    except ImportError:
        return {
            "ticker": ticker,
            "weight": weight,
            "market": market_label,
            "error": "yfinance_not_installed",
            "data_quality": "failed",
        }

    try:
        _, info, iv, put_call_ratio, pcr_source = _yf_info_and_options(ticker)

        pe_ttm = _safe_float(info.get("trailingPE"))
        pe_forward = _safe_float(info.get("forwardPE"))
        pb = _safe_float(info.get("priceToBook"))

        if prefer_ak_pe_pb:
            if prefer_ak_pe_pb.get("pe_ttm") is not None:
                pe_ttm = prefer_ak_pe_pb["pe_ttm"]
            if prefer_ak_pe_pb.get("pb") is not None:
                pb = prefer_ak_pe_pb["pb"]
            if prefer_ak_pe_pb.get("name"):
                name = prefer_ak_pe_pb["name"]
            else:
                name = info.get("longName") or info.get("shortName") or ticker
        else:
            name = info.get("longName") or info.get("shortName") or ticker

        put_call_ratio, pcr_source = _apply_beta_pcr_proxy(info, put_call_ratio, pcr_source)
        beta = _safe_float(info.get("beta"))
        data_quality = _data_quality(ticker, iv)
        div_y = _safe_float(info.get("dividendYield"))
        if div_y is not None and div_y <= 1.0:
            div_y = div_y * 100.0

        return {
            "ticker": ticker,
            "weight": weight,
            "market": market_label,
            "name": name,
            "pe_ttm": pe_ttm,
            "pe_forward": pe_forward,
            "pb": pb,
            "beta": beta,
            "dividend_yield": round(div_y, 3) if div_y is not None else None,
            "implied_volatility": round(iv, 4) if iv is not None else None,
            "put_call_ratio": round(put_call_ratio, 3) if put_call_ratio is not None else None,
            "pcr_source": pcr_source,
            "sector": info.get("sector"),
            "market_cap": info.get("marketCap"),
            "data_source": data_source,
            "data_quality": data_quality,
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "weight": weight,
            "market": market_label,
            "error": str(e),
            "data_source": data_source,
            "data_quality": "failed",
        }


def fetch_hk_data(ticker: str, weight: float) -> dict:
    """港股：AkShare 估值对比（PE-TTM / PB-MRQ）+ yfinance 补充 beta/sector/期权等。"""
    code = ticker.upper().replace(".HK", "").strip().zfill(5)
    ak_pe_pb_name: dict | None = None
    ak_ok = False
    try:
        import akshare as ak

        df = ak.stock_hk_valuation_comparison_em(symbol=code)
        if df is not None and not df.empty:
            r = df.iloc[0]
            ak_pe_pb_name = {
                "name": r.get("简称") or ticker,
                "pe_ttm": _safe_float(r.get("市盈率-TTM")),
                "pb": _safe_float(r.get("市净率-MRQ")),
            }
            ak_ok = ak_pe_pb_name.get("pe_ttm") is not None or ak_pe_pb_name.get("pb") is not None
    except Exception:
        pass

    src = "akshare_hk+yfinance" if ak_ok else "yfinance"
    return _build_from_yf(ticker, weight, "HK", src, prefer_ak_pe_pb=ak_pe_pb_name)


def fetch_us_data(ticker: str, weight: float) -> dict:
    """美股：yfinance + 期权链（与历史逻辑一致）。"""
    return _build_from_yf(ticker, weight, "US", "yfinance", prefer_ak_pe_pb=None)


def _try_akshare_kr_fundamentals(code: str) -> dict | None:
    """若未来 AkShare 提供韩股行情（如 stock_kr_em），则从此取 PE/PB。当前版本通常不可用。"""
    try:
        import akshare as ak

        fn = getattr(ak, "stock_kr_em", None)
        if not callable(fn):
            return None
        df = fn()
        if df is None or getattr(df, "empty", True):
            return None
        code_col = "代码" if "代码" in df.columns else None
        if not code_col:
            return None
        row = df[df[code_col].astype(str).str.replace(".0", "", regex=False) == code]
        if row.empty:
            row = df[df[code_col].astype(str).str.zfill(6) == code.zfill(6)]
        if row.empty:
            return None
        r = row.iloc[0]
        pe = None
        pb = None
        for k in ("市盈率", "市盈率-TTM", "PE", "pe_ttm", "PER"):
            if k in r.index and r.get(k) is not None:
                pe = _safe_float(r.get(k))
                if pe is not None and pe != 0:
                    break
        for k in ("市净率", "市净率-MRQ", "PB", "pb", "PBR"):
            if k in r.index and r.get(k) is not None:
                pb = _safe_float(r.get(k))
                if pb is not None and pb != 0:
                    break
        if pe is None and pb is None:
            return None
        name = None
        for k in ("名称", "简称", "name"):
            if k in r.index and r.get(k):
                name = str(r.get(k)).strip()
                break
        return {"pe_ttm": pe, "pb": pb, "name": name}
    except Exception:
        return None


def _try_naver_kr_fundamentals(code: str) -> dict | None:
    """Naver 股票主页解析 TTM PER（_per）与 PBR（_pbr）。韩股 6 位代码。"""
    try:
        import re

        import requests
    except ImportError:
        return None

    url = f"https://finance.naver.com/item/main.naver?code={code}"
    try:
        r = requests.get(
            url,
            timeout=(5, 10),
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            },
        )
        r.raise_for_status()
        html = r.text
    except Exception:
        return None

    def _parse_em(pattern: str) -> float | None:
        m = re.search(pattern, html)
        if not m:
            return None
        raw = m.group(1).replace(",", "").strip()
        return _safe_float(raw)

    pe = _parse_em(r'<em\s+id="_per">([\d,.]+)</em>\s*배')
    pb = _parse_em(r'<em\s+id="_pbr">([\d,.]+)</em>\s*배')
    if pe is None and pb is None:
        return None
    return {"pe_ttm": pe, "pb": pb}


def _try_pykrx_kr_fundamentals(ticker: str) -> dict | None:
    """可选：PyKRX 全市场基本面（部分环境 KRX 返回格式异常会失败）。未安装 pykrx 时跳过。"""
    try:
        from datetime import datetime, timedelta

        from pykrx import stock
    except ImportError:
        return None

    raw = ticker.upper().strip().split(".")[0]
    code = raw.zfill(6)
    suffix = ticker.upper().split(".")[-1] if "." in ticker.upper() else "KS"
    markets = ("KOSDAQ", "KOSPI") if suffix == "KQ" else ("KOSPI", "KOSDAQ")

    for market in markets:
        for days_back in range(0, 10):
            d = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
            try:
                df = stock.get_market_fundamental_by_ticker(d, market=market, alternative=True)
            except Exception:
                continue
            if df is None or getattr(df, "empty", True):
                continue
            if not all(c in df.columns for c in ("PER", "PBR")):
                continue
            idx = df.index.astype(str).str.zfill(6)
            if code not in set(idx):
                continue
            row = df.loc[idx == code].iloc[0]
            per = _safe_float(row.get("PER"))
            pbr = _safe_float(row.get("PBR"))
            if per is not None and per == 0:
                per = None
            if pbr is not None and pbr == 0:
                pbr = None
            if per is None and pbr is None:
                continue
            return {"pe_ttm": per, "pb": pbr}
    return None


def fetch_kr_data(ticker: str, weight: float) -> dict:
    """韩股：AkShare（若未来提供）→ Naver _per/_pbr → 可选 PyKRX → 与 yfinance 合并。"""
    code = ticker.split(".")[0].strip().zfill(6)
    prefer: dict | None = _try_akshare_kr_fundamentals(code)
    src = "akshare_kr+yfinance" if prefer else None
    if prefer is None:
        prefer = _try_naver_kr_fundamentals(code)
        src = "naver_kr+yfinance" if prefer else None
    if prefer is None:
        prefer = _try_pykrx_kr_fundamentals(ticker)
        src = "pykrx_kr+yfinance" if prefer else None

    if prefer is not None:
        return _build_from_yf(ticker, weight, "KR", src or "yfinance", prefer_ak_pe_pb=prefer)
    return _build_from_yf(ticker, weight, "KR", "yfinance", prefer_ak_pe_pb=None)


def fetch_cn_data(ticker: str, weight: float) -> dict:
    """A 股：AkShare 东财实时行情；失败则回退 yfinance。"""
    code = ticker.split(".")[0].strip()
    try:
        import akshare as ak

        df = ak.stock_zh_a_spot_em()
        row = df[df["代码"] == code]
        if row.empty:
            return _build_from_yf(ticker, weight, "CN", "yfinance", prefer_ak_pe_pb=None)
        r = row.iloc[0]
        prefer = {
            "name": r.get("名称") or ticker,
            "pe_ttm": _safe_float(r.get("市盈率-动态")),
            "pb": _safe_float(r.get("市净率")),
        }
        return _build_from_yf(ticker, weight, "CN", "akshare_cn+yfinance", prefer_ak_pe_pb=prefer)
    except Exception:
        return _build_from_yf(ticker, weight, "CN", "yfinance", prefer_ak_pe_pb=None)


def fetch_other_data(ticker: str, weight: float, market: str) -> dict:
    """台/韩/日等：先用 yfinance（与旧版单源一致）。"""
    label = market.upper()
    return _build_from_yf(ticker, weight, label, "yfinance", prefer_ak_pe_pb=None)


def fetch_holding_data(ticker: str, weight: float) -> dict:
    m = detect_market(ticker)
    if m == "us":
        return fetch_us_data(ticker, weight)
    if m == "hk":
        return fetch_hk_data(ticker, weight)
    if m == "cn":
        return fetch_cn_data(ticker, weight)
    if m == "kr":
        return fetch_kr_data(ticker, weight)
    return fetch_other_data(ticker, weight, m)


def _fetch_single_holding(item: dict) -> dict:
    t = (item.get("ticker") or "").strip()
    w = _safe_float(item.get("weight")) or 0.0
    if not t:
        return {"ticker": "", "weight": w, "error": "empty_ticker"}
    cached = _get_cached(t)
    if cached is not None:
        merged = {**cached, "weight": w, "cached": True}
        return merged
    max_retries = 3
    for attempt in range(max_retries):
        result = fetch_holding_data(t, w)
        err_msg = str(result.get("error") or "")
        if not err_msg:
            if _is_clean_for_cache(result):
                _set_cache(t, result)
            return result
        # 仅对 429 / 限流做指数退避重试
        if _is_rate_limited_error(err_msg) and attempt < max_retries - 1:
            sleep_s = (2 ** attempt) + random.uniform(0.3, 1.2)
            time.sleep(sleep_s)
            continue
        return result
    return {"ticker": t, "weight": w, "error": "unknown_fetch_failure"}


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_json_arg"}, ensure_ascii=False))
        sys.exit(1)
    raw = sys.argv[1].strip()
    # Windows / shell 友好：@path 从文件读入 JSON（UTF-8）
    if raw.startswith("@"):
        from pathlib import Path

        path = Path(raw[1:]).expanduser()
        try:
            raw = path.read_text(encoding="utf-8").strip()
        except OSError as e:
            print(json.dumps({"error": f"read_arg_file:{e}"}, ensure_ascii=False))
            sys.exit(1)
    try:
        holdings = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "invalid_json"}, ensure_ascii=False))
        sys.exit(1)
    if not isinstance(holdings, list):
        print(json.dumps({"error": "holdings_must_be_array"}, ensure_ascii=False))
        sys.exit(1)
    parsed: list[dict] = []
    for h in holdings:
        if not isinstance(h, dict):
            continue
        t = (h.get("ticker") or "").strip()
        w = _safe_float(h.get("weight")) or 0.0
        if not t:
            continue
        parsed.append({"ticker": t, "weight": w})
    parsed.sort(key=lambda x: x.get("weight") or 0.0, reverse=True)
    parsed = parsed[:20]
    if not parsed:
        print(json.dumps([], ensure_ascii=False))
        return
    # 反爬：串行抓取 + 随机延迟，避免触发上游限流
    results: list[dict] = []
    for idx, item in enumerate(parsed):
        try:
            row = _fetch_single_holding(item)
            results.append(row)
        except Exception as e:
            t = (item.get("ticker") or "").strip()
            w = _safe_float(item.get("weight")) or 0.0
            results.append({"ticker": t, "weight": w, "error": str(e)})
        # 请求间随机停顿（最后一条无需 sleep）；缓存命中时跳过等待
        is_cached = bool(results[-1].get("cached"))
        if idx < len(parsed) - 1 and not is_cached:
            time.sleep(random.uniform(1.0, 3.0))
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
