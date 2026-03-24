# -*- coding: utf-8 -*-
import os, sys, sqlite3, requests, time, math
from pathlib import Path
from datetime import date
import pandas as pd
import yfinance as yf

NAV_DB = os.environ.get("NAV_HISTORY_DB", "/root/data/nav_history.db")
SUPABASE_URL = "https://wpsiqvbhxhzrynfhbwno.supabase.co"
SUPABASE_KEY = "sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz"
SYNC = True
SLEEP = 2  # 每个基金之间等待秒数

# MRF 16 只目标代码（统一 968 数字代码）
MRF_CODES = [
    "968001", "968002", "968003", "968004", "968005", "968006", "968007",
    "968009", "968010", "968011", "968012", "968013", "968014", "968030",
    "968031", "968166",
]

def get_conn():
    Path(NAV_DB).parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(NAV_DB, timeout=30)

def get_fund_list():
    conn = get_conn()
    df = pd.read_sql("SELECT code, isin, ccy, nav_source, yahoo_symbol FROM fund_list", conn)
    conn.close()
    return df


def ensure_mrf_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    保证 MRF 目标代码都进入抓取队列。
    若 fund_list 缺失，则补一条占位行（isin=code, ccy=HKD）。
    """
    out = df.copy()
    existing = set(out["code"].astype(str).str.strip().tolist()) if not out.empty else set()
    missing = [c for c in MRF_CODES if c not in existing]
    for c in missing:
        out = pd.concat(
            [
                out,
                pd.DataFrame([{"code": c, "isin": c, "ccy": "HKD", "nav_source": "mrf", "yahoo_symbol": None}]),
            ],
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


def download_akshare_968(code, ccy="HKD", history=False):
    """
    直接按 968 代码拉香港基金历史净值，写入 nav_history 所需行格式。
    isin 字段统一写 code（与 fund_list/sync_mrf_to_supabase 对齐）。
    """
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
            if nav and not math.isnan(nav):
                rows.append((str(code), ccy or "HKD", ds, round(nav, 6), "akshare"))
        return rows
    except Exception:
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
    only_mrf = "--only-mrf" in sys.argv
    only_qd = "--only-qd" in sys.argv
    if only_mrf and only_qd:
        print("参数冲突：--only-mrf 与 --only-qd 不能同时使用")
        return
    print(f"模式: {'历史补全' if history else '增量更新'}")
    funds = ensure_mrf_rows(get_fund_list())
    if only_mrf:
        funds = funds[funds["code"].astype(str).str.strip().isin(MRF_CODES)].copy()
        print("运行范围: 仅 MRF (968)")
    elif only_qd:
        funds = funds[~funds["code"].astype(str).str.strip().isin(MRF_CODES)].copy()
        print("运行范围: 仅 QD/非 MRF")
    print(f"基金数量: {len(funds)}\n")

    success, fail = 0, 0
    all_new = []

    for idx, (_, f) in enumerate(funds.iterrows()):
        isin, ccy = f["isin"], f["ccy"]
        symbol = f.get("yahoo_symbol")
        print(f"[{idx+1}/{len(funds)}] {f['code']} ({isin})...")

        rows = []
        code = str(f.get("code") or "").strip()
        # MRF 统一 968 先走 akshare，确保 16 只可抓
        if code in MRF_CODES:
            rows = download_akshare_968(code, ccy, history)
            if rows:
                print(f"  AKShare(968): {len(rows)} 条")
        # 先试 FT
        if not rows:
            ft_rows = download_ft(isin, ccy, history)
            if ft_rows:
                rows = ft_rows
                print(f"  FT: {len(rows)} 条")
        # FT 没有再试 Yahoo
        if not rows and symbol and str(symbol) not in ("None", "nan", ""):
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
