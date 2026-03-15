"""
pages/nav_chart.py
QD 基金历史业绩曲线
- 数据源自动切换：Supabase（云端）→ 本地 SQLite（fallback）
- 多只基金对比（统一基准 100）
- 区间：1M / 3M / 6M / YTD / 1Y / 2Y / 3Y / 全部
- 对比线：SPY / QQQ / 恒生（Yahoo 实时拉）
- 统计：区间回报、最大回撤、年化波动、夏普比率
"""

import os
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import streamlit as st

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
NAV_DB_LOCAL = os.environ.get("NAV_HISTORY_DB", r"E:\FinancialData\nav_history.db")

PERIOD_OPTIONS = {
    "1个月": 30, "3个月": 90, "6个月": 180,
    "YTD": None, "1年": 365, "2年": 730, "3年": 1095, "全部": None,
}

COLORS = ["#185FA5","#993C1D","#0F6E56","#534AB7","#854F0B",
          "#A32D2D","#3B6D11","#BA7517","#444441","#0C447C"]

FUND_NAME_MAP = {
    "QDUR134USD":"贝莱德世界科技基金","QDUR045USD":"富兰克林科技基金",
    "QDUR100USD":"联博美国增长基金","QDUR180USD":"法巴美国增长基金",
    "QDUR104USD":"安联环球AI股票基金","QDUT001USD":"邓普顿亚洲增长基金",
    "QDUR101USD":"联博亚洲股票基金","QDUT011USD":"富达亚洲ESG基金",
    "QDUR170USD":"贝莱德新兴市场基金","QDUR109USD":"摩根中国基金",
    "QDUR006USD":"霸菱香港中国基金","QDUT028USD":"施罗德中国优势基金",
    "QDUR121USD":"宏利亚太REIT基金","QDUR139USD":"摩根美国基金",
    "QDUR119USD":"富达环球人口趋势基金","QDUR022USD":"贝莱德美国灵活股票基金",
    "QDUR050USD":"富兰克林美国机会基金","QDUR075USD":"富达环球房地产基金",
    "QDUR125USD":"富达美元债券基金",
}


def _is_supabase() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)

def _is_local() -> bool:
    return Path(NAV_DB_LOCAL).exists()


@st.cache_resource
def _supabase():
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        return None


@st.cache_resource
def _local_conn():
    import sqlite3
    p = Path(NAV_DB_LOCAL)
    if not p.exists():
        return None
    c = sqlite3.connect(f"file:{p}?mode=ro", uri=True, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


@st.cache_data(ttl=600)
def load_fund_list() -> pd.DataFrame:
    if _is_supabase():
        try:
            r = _supabase().table("fund_list").select("code,isin,ccy,nav_source").execute()
            if r.data:
                df = pd.DataFrame(r.data)
                df["display_name"] = df["code"].map(FUND_NAME_MAP).fillna(df["code"])
                return df
        except Exception:
            pass
    conn = _local_conn()
    if conn is None:
        return pd.DataFrame()
    try:
        df = pd.read_sql("SELECT code,isin,ccy,nav_source FROM fund_list ORDER BY code", conn)
        df["display_name"] = df["code"].map(FUND_NAME_MAP).fillna(df["code"])
        return df
    except Exception:
        return pd.DataFrame()


@st.cache_data(ttl=60)
def load_nav(isin: str, ccy: str, start_date: str) -> pd.Series:
    if _is_supabase():
        try:
            r = (_supabase().table("nav_history")
                 .select("nav_date,nav")
                 .eq("isin", isin).eq("ccy", ccy)
                 .gte("nav_date", start_date)
                 .order("nav_date").execute())
            if r.data:
                df = pd.DataFrame(r.data)
                df["nav_date"] = pd.to_datetime(df["nav_date"])
                return df.set_index("nav_date")["nav"].astype(float)
        except Exception:
            pass
    conn = _local_conn()
    if conn is None:
        return pd.Series(dtype=float)
    try:
        df = pd.read_sql(
            "SELECT nav_date,nav FROM nav_history WHERE isin=? AND ccy=? AND nav_date>=? ORDER BY nav_date",
            conn, params=(isin, ccy, start_date))
        if df.empty:
            return pd.Series(dtype=float)
        df["nav_date"] = pd.to_datetime(df["nav_date"])
        return df.set_index("nav_date")["nav"].astype(float)
    except Exception:
        return pd.Series(dtype=float)


def calc_stats(s: pd.Series, label: str) -> dict:
    if s.empty or len(s) < 2:
        return {"基金":label,"区间回报":"—","年化波动":"—","最大回撤":"—","夏普":"—","数据点":0}
    ret  = (s.iloc[-1]/s.iloc[0]-1)*100
    days = max((s.index[-1]-s.index[0]).days, 1)
    yrs  = days/365.25
    vol  = s.pct_change().dropna().std()*(252**0.5)*100
    ann  = (1+ret/100)**(1/yrs)-1 if yrs>0 else 0
    shrp = (ann/(vol/100)) if vol>0 else 0
    dd   = ((s-s.cummax())/s.cummax()*100).min()
    return {"基金":label,"区间回报":f"{ret:+.2f}%","年化波动":f"{vol:.1f}%",
            "最大回撤":f"{dd:.1f}%","夏普":f"{shrp:.2f}","数据点":len(s)}


def to_indexed(s: pd.Series) -> pd.Series:
    return s/s.iloc[0]*100 if not s.empty else s


def get_start(label: str) -> str:
    today = date.today()
    days  = PERIOD_OPTIONS[label]
    if days is None:
        return date(today.year,1,1).isoformat() if label=="YTD" else "2000-01-01"
    return (today-timedelta(days=days)).isoformat()


@st.cache_data(ttl=3600)
def fetch_index(ticker: str, start: str):
    try:
        import yfinance as yf
        h = yf.Ticker(ticker).history(start=start)
        if h is not None and not h.empty:
            s = h["Close"].dropna()
            s.index = s.index.tz_localize(None)
            return s
    except Exception:
        pass
    return None


def render(is_mobile: bool = False):
    st.title("📈 QD 基金历史业绩")

    if _is_supabase():
        st.caption("数据源：Supabase 云端 ☁️  · 每日自动更新")
    elif _is_local():
        st.caption(f"数据源：本地数据库 💻  `{Path(NAV_DB_LOCAL).name}`")
    else:
        _setup_guide(); return

    fund_df = load_fund_list()
    if fund_df.empty:
        st.warning("基金列表为空，请先同步数据"); return

    c1, c2, c3 = st.columns([3,2,2])
    with c1:
        names = fund_df["display_name"].tolist()
        sel = st.multiselect("选择基金（最多6只）", names,
                             default=names[:3], max_selections=6,
                             label_visibility="collapsed", placeholder="选择基金...")
    with c2:
        period = st.segmented_control("区间", list(PERIOD_OPTIONS),
                                      default="1年", label_visibility="collapsed") or "1年"
    with c3:
        idx_sel = st.multiselect("对比指数",
                                 ["标普500 (SPY)","纳斯达克 (QQQ)","恒生指数 (^HSI)"],
                                 default=[], label_visibility="collapsed",
                                 placeholder="添加对比指数...")

    if not sel:
        st.info("请选择至少一只基金"); return

    start = get_start(period)
    n2r   = fund_df.set_index("display_name").to_dict("index")
    smap: dict[str, pd.Series] = {}

    with st.spinner("加载数据..."):
        for name in sel:
            row = n2r.get(name)
            if row:
                s = load_nav(row["isin"], row["ccy"], start)
                if not s.empty:
                    smap[name] = s
        tm = {"标普500 (SPY)":"SPY","纳斯达克 (QQQ)":"QQQ","恒生指数 (^HSI)":"^HSI"}
        for lbl in idx_sel:
            t = tm.get(lbl)
            if t:
                s = fetch_index(t, start)
                if s is not None:
                    smap[lbl] = s

    if not smap:
        st.warning("所选区间内无数据，请扩大时间范围"); return

    common = max(s.index[0] for s in smap.values())
    indexed = {n: to_indexed(s[s.index>=common]) for n,s in smap.items()
               if not s[s.index>=common].empty}

    # 图表
    try:
        import plotly.graph_objects as go
        fig = go.Figure()
        for i, (name, s) in enumerate(indexed.items()):
            is_idx = name not in sel
            fig.add_trace(go.Scatter(
                x=s.index, y=s.values.round(2), name=name,
                line=dict(color=COLORS[i%len(COLORS)],
                          width=1.5 if is_idx else 2,
                          dash="dot" if is_idx else "solid"),
                hovertemplate="%{x|%Y-%m-%d}  %{y:.2f}<extra>"+name+"</extra>",
            ))
        fig.update_layout(
            height=420, margin=dict(l=0,r=0,t=10,b=0),
            hovermode="x unified",
            legend=dict(orientation="h",yanchor="bottom",y=1.02,xanchor="left",x=0),
            yaxis=dict(title="净值（基准=100）",tickformat=".1f",gridcolor="#ebebeb"),
            xaxis=dict(gridcolor="#ebebeb"),
            plot_bgcolor="white", paper_bgcolor="white",
        )
        fig.add_hline(y=100, line_dash="dash", line_color="#ccc", line_width=1)
        st.plotly_chart(fig, use_container_width=True)
    except ImportError:
        st.line_chart(pd.DataFrame(indexed), height=420)

    # 摘要卡
    fund_s = {k:v for k,v in smap.items() if k in sel}
    if fund_s:
        n_cols = 2 if is_mobile else len(fund_s)
        cols = st.columns(n_cols)
        for i, (name, s) in enumerate(fund_s.items()):
            col = cols[i % n_cols]
            if not s.empty:
                ret1m = (s.iloc[-1]/s.iloc[max(0,len(s)-22)]-1)*100 if len(s)>5 else 0
                col.metric(name[:14], f"{s.iloc[-1]:.3f}", f"{ret1m:+.2f}% (近1月)")

    # 统计表
    st.divider()
    stats = [calc_stats(s, n) for n,s in smap.items() if n in indexed]
    if stats:
        df = pd.DataFrame(stats).set_index("基金")
        def cr(v):
            if isinstance(v,str):
                if v.startswith("+"): return "color:#0F6E56;font-weight:600"
                if v.startswith("-"): return "color:#A32D2D;font-weight:600"
            return ""
        def cd(v):
            if isinstance(v,str):
                try:
                    n=float(v.replace("%",""))
                    if n<-15: return "color:#A32D2D"
                    if n<-8:  return "color:#BA7517"
                except: pass
            return ""
        st.dataframe(df.style.applymap(cr,subset=["区间回报"])
                             .applymap(cd,subset=["最大回撤"]),
                     use_container_width=True)

    with st.expander("查看原始净值"):
        combined = pd.DataFrame(smap).sort_index(ascending=False).head(60)
        combined.index = combined.index.strftime("%Y-%m-%d")
        st.dataframe(combined.round(4), use_container_width=True)


def _setup_guide():
    st.warning("未找到净值数据")
    st.markdown("""
### 配置步骤

**① 注册 Supabase（免费）**  
[supabase.com](https://supabase.com) → New Project

**② 建表**（在 Supabase SQL Editor 执行）
```sql
CREATE TABLE nav_history (
    isin TEXT, ccy TEXT, nav_date DATE,
    nav NUMERIC, source TEXT,
    PRIMARY KEY (isin, ccy, nav_date)
);
CREATE TABLE fund_list (
    code TEXT, isin TEXT, ccy TEXT,
    bbg TEXT, nav_source TEXT,
    PRIMARY KEY (isin, ccy)
);
ALTER TABLE nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_list   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON nav_history FOR SELECT USING (true);
CREATE POLICY "read" ON fund_list   FOR SELECT USING (true);
```

**③ 本地设置环境变量 + 首次同步**
```bash
pip install supabase
set SUPABASE_URL=https://xxxxx.supabase.co
set SUPABASE_KEY=your-anon-key
python supabase_sync.py --all
```

**④ 修改下载脚本末尾（qd_download_nav.py）加2行**
```python
import supabase_sync
supabase_sync.sync(days=7)   # 每次下载后自动同步最近7天
```

**⑤ Streamlit Cloud → Settings → Secrets 填入**
```toml
SUPABASE_URL = "https://xxxxx.supabase.co"
SUPABASE_KEY = "your-anon-key"
```
""")

