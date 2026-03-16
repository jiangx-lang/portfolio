# -*- coding: utf-8 -*-
import os, sys, sqlite3, requests, time, math
from pathlib import Path
from datetime import date
import pandas as pd
import yfinance as yf

NAV_DB = "/root/data/nav_history.db"
SUPABASE_URL = "https://wpsiqvbhxhzrynfhbwno.supabase.co"
SUPABASE_KEY = "sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz"
SYNC = True
SLEEP = 2  # 每个基金之间等待秒数

def get_conn():
    return sqlite3.connect(NAV_DB, timeout=30)

def get_fund_list():
    conn = get_conn()
    df = pd.read_sql("SELECT code, isin, ccy, nav_source, yahoo_symbol FROM fund_list", conn)
    conn.close()
    return df

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
        # 优先用 max，失败自动降级
        for period in (["max", "10y", "5y"] if history else ["5d"]):
            try:
                tk = yf.Ticker(symbol)
                df = tk.history(period=period)
                if df is not None and not df.empty:
                    rows = []
                    for dt, row in df.iterrows():
                        nav = row["Close"]
                        if nav and not math.isnan(float(nav)):
                            rows.append((isin, ccy, str(dt.date()), round(float(nav), 6), "yahoo"))
                    return rows
            except Exception:
                continue
        return []
    except Exception as e:
        print(f"  Yahoo 失败 {symbol}: {e}")
        return []

def download_ft(isin, ccy, history=False):
    try:
        start = "2000-01-01" if history else str(date.today().replace(day=1))
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://markets.ft.com/",
        }
        url = f"https://markets.ft.com/data/funds/ajax/get-historical-prices?startDate={start}&isin={isin}"
        r = requests.get(url, timeout=20, headers=headers)
        if r.status_code != 200:
            return []
        data = r.json()
        rows = []
        for item in data.get("data", {}).get("timeSeriesData", []):
            try:
                nav = float(item["closePrice"])
                if not math.isnan(nav):
                    rows.append((isin, ccy, item["date"][:10], nav, "FT"))
            except:
                pass
        return rows
    except Exception as e:
        return []

def sync_supabase(rows):
    if not SYNC or not rows:
        return
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    batch = [{"isin": r[0], "ccy": r[1], "nav_date": r[2], "nav": r[3], "source": r[4]}
             for r in rows if r[3] and not math.isnan(float(r[3]))]
    url = f"{SUPABASE_URL}/rest/v1/nav_history?on_conflict=isin,ccy,nav_date"
    for i in range(0, len(batch), 500):
        try:
            resp = requests.post(url, headers=headers, json=batch[i:i+500], timeout=30)
            if not resp.ok:
                print(f"  Supabase 失败: {resp.status_code}")
        except Exception as e:
            print(f"  Supabase 异常: {e}")

def main():
    history = "--history" in sys.argv
    print(f"模式: {'历史补全' if history else '增量更新'}")
    funds = get_fund_list()
    print(f"基金数量: {len(funds)}\n")

    success, fail = 0, 0
    all_new = []

    for idx, (_, f) in enumerate(funds.iterrows()):
        isin, ccy = f["isin"], f["ccy"]
        symbol = f.get("yahoo_symbol")
        print(f"[{idx+1}/{len(funds)}] {f['code']} ({isin})...")

        rows = []
        # 先试 FT
        ft_rows = download_ft(isin, ccy, history)
        if ft_rows:
            rows = ft_rows
            print(f"  FT: {len(rows)} 条")
        # FT 没有再试 Yahoo
        elif symbol and str(symbol) not in ("None", "nan", ""):
            time.sleep(SLEEP)  # 避免限流
            rows = download_yahoo(isin, ccy, symbol, history)
            if rows:
                print(f"  Yahoo: {len(rows)} 条")

        if rows:
            saved = save_nav(rows)
            all_new.extend(rows)
            print(f"  写入: {saved} 条")
            success += 1
        else:
            print(f"  ⚠️ 无数据")
            fail += 1

        # 每10个基金同步一次 Supabase，避免积累太多
        if len(all_new) >= 5000:
            print(f"\n  同步 {len(all_new)} 条到 Supabase...")
            sync_supabase(all_new)
            all_new = []

        time.sleep(SLEEP)

    # 最后同步剩余
    if all_new:
        print(f"\n最终同步 {len(all_new)} 条到 Supabase...")
        sync_supabase(all_new)

    print(f"\n完成！成功: {success} 只，无数据: {fail} 只")

if __name__ == "__main__":
    main()
