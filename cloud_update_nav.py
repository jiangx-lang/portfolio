# -*- coding: utf-8 -*-
"""
云端 NAV 下载脚本 - 从 fund_list 读取基金列表，用 yfinance 和 FT 下载历史数据
写入 /root/data/nav_history.db 并同步到 Supabase
"""
import os, sys, sqlite3, requests
from pathlib import Path
from datetime import date
import pandas as pd
import yfinance as yf

NAV_DB = "/root/data/nav_history.db"
SUPABASE_URL = "https://wpsiqvbhxhzrynfhbwno.supabase.co"
SUPABASE_KEY = "sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz"
SYNC = True

MRF_CODES = [
    "968001", "968002", "968003", "968004", "968005", "968006", "968007",
    "968009", "968010", "968011", "968012", "968013", "968014", "968030",
    "968031", "968166",
]

def get_conn():
    return sqlite3.connect(NAV_DB, timeout=30)

def get_fund_list():
    conn = get_conn()
    df = pd.read_sql("SELECT code, isin, ccy, nav_source, yahoo_symbol FROM fund_list", conn)
    conn.close()
    return df


def ensure_mrf_rows(df):
    out = df.copy()
    existing = set(out["code"].astype(str).str.strip().tolist()) if not out.empty else set()
    missing = [c for c in MRF_CODES if c not in existing]
    for c in missing:
        out = pd.concat(
            [out, pd.DataFrame([{"code": c, "isin": c, "ccy": "HKD", "nav_source": "mrf", "yahoo_symbol": None}])],
            ignore_index=True,
        )
    if missing:
        print(f"补入缺失 MRF 代码到抓取队列: {', '.join(missing)}")
    return out

def save_nav(rows):
    if not rows:
        return 0
    conn = get_conn()
    conn.executemany(
        "INSERT OR IGNORE INTO nav_history (isin, ccy, nav_date, nav, source) VALUES (?,?,?,?,?)",
        rows
    )
    conn.commit()
    conn.close()
    return len(rows)

def download_yahoo(isin, ccy, symbol, history=False):
    try:
        period = "max" if history else "5d"
        tk = yf.Ticker(symbol)
        df = tk.history(period=period)
        if df.empty:
            return []
        rows = []
        for dt, row in df.iterrows():
            rows.append((isin, ccy, str(dt.date()), round(float(row["Close"]), 6), "yahoo"))
        return rows
    except Exception as e:
        print(f"  Yahoo 失败 {symbol}: {e}")
        return []

def download_ft(isin, ccy, history=False):
    try:
        start = "2000-01-01" if history else str(date.today().replace(day=1))
        url = f"https://markets.ft.com/data/funds/ajax/get-historical-prices?startDate={start}&isin={isin}"
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        data = r.json()
        rows = []
        for item in data.get("data", {}).get("timeSeriesData", []):
            try:
                rows.append((isin, ccy, item["date"][:10], float(item["closePrice"]), "FT"))
            except:
                pass
        return rows
    except Exception as e:
        print(f"  FT 失败 {isin}: {e}")
        return []


def download_akshare_968(code, ccy="HKD", history=False):
    try:
        import akshare as ak
    except Exception:
        return []
    try:
        df = ak.fund_hk_fund_hist_em(code=str(code), symbol="历史净值明细")
        if df is None or df.empty:
            return []
        date_col = next((c for c in df.columns if "日期" in str(c)), df.columns[0])
        nav_candidates = [c for c in df.columns if "净值" in str(c)]
        nav_col = nav_candidates[0] if nav_candidates else (df.columns[1] if len(df.columns) > 1 else None)
        if nav_col is None:
            return []
        rows = []
        for _, r in df.iterrows():
            ds = str(r.get(date_col) or "").strip()
            if not ds:
                continue
            ds = ds[:10].replace("/", "-")
            try:
                nav = float(r.get(nav_col))
            except Exception:
                continue
            rows.append((str(code), ccy or "HKD", ds, round(nav, 6), "akshare"))
        return rows
    except Exception:
        return []

def sync_supabase(new_rows):
    if not SYNC or not new_rows:
        return
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    batch = [{"isin": r[0], "ccy": r[1], "nav_date": r[2], "nav": r[3], "source": r[4]} for r in new_rows]
    url = f"{SUPABASE_URL}/rest/v1/nav_history?on_conflict=isin,ccy,nav_date"
    for i in range(0, len(batch), 500):
        try:
            resp = requests.post(url, headers=headers, json=batch[i:i+500], timeout=30)
            if not resp.ok:
                print(f"  Supabase 同步失败: {resp.status_code}")
        except Exception as e:
            print(f"  Supabase 异常: {e}")

def main():
    history = "--history" in sys.argv
    print(f"模式: {'历史补全' if history else '增量更新'}")
    funds = ensure_mrf_rows(get_fund_list())
    print(f"基金数量: {len(funds)}")
    all_new = []
    for _, f in funds.iterrows():
        isin, ccy, symbol = f["isin"], f["ccy"], f.get("yahoo_symbol")
        print(f"处理 {f['code']} ({isin})...")
        rows = []
        code = str(f.get("code") or "").strip()
        if code in MRF_CODES:
            rows = download_akshare_968(code, ccy, history)
            print(f"  AKShare: {len(rows)} 条")
        if symbol and str(symbol) != "None" and str(symbol) != "nan":
            if not rows:
                rows = download_yahoo(isin, ccy, symbol, history)
                print(f"  Yahoo: {len(rows)} 条")
        if not rows:
            rows = download_ft(isin, ccy, history)
            print(f"  FT: {len(rows)} 条")
        saved = save_nav(rows)
        print(f"  新增写入: {saved} 条")
        all_new.extend(rows)
    print(f"\n同步到 Supabase ({len(all_new)} 条)...")
    sync_supabase(all_new)
    print("完成！")

if __name__ == "__main__":
    main()
