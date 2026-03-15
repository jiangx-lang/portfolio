"""
pages/fund_detail.py
基金详情页 — 业绩曲线 + 持仓分析 + 区域/板块分布
"""

import os
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px

# ── 数据源：nav_history.db / fund_tagging.db ─────────────────────────
try:
    from config import NAV_HISTORY_DB, FUND_TAGGING_DB
    NAV_DB = str(NAV_HISTORY_DB)
    TAG_DB = str(FUND_TAGGING_DB)
except ImportError:
    NAV_DB = os.environ.get("NAV_HISTORY_DB", r"E:\FinancialData\nav_history.db")
    TAG_DB = os.environ.get("FUND_TAGGING_DB", "fund_tagging.db")

PERIOD_MAP = {
    "YTD": None,
    "1个月": 30,
    "3个月": 90,
    "6个月": 180,
    "1年": 365,
    "2年": 730,
    "3年": 1095,
    "5年": 1825,
    "全部": None,
}

COLORS = ["#185FA5", "#993C1D", "#0F6E56", "#534AB7", "#854F0B",
          "#3B6D11", "#BA7517", "#444441", "#A32D2D", "#0C447C"]


# ── 数据加载 ──────────────────────────────────────────────────────
@st.cache_data(ttl=300)
def load_fund_meta(fund_id: int) -> dict:
    """从 fund_meta 加载基金元信息（优先 fund_meta.csv，否则 fund_meta_builder）"""
    try:
        meta_path = Path(__file__).resolve().parent.parent / "data" / "fund_meta.csv"
        if meta_path.exists():
            df = pd.read_csv(meta_path, encoding="utf-8-sig")
            row = df[df["fund_id"] == fund_id]
            if not row.empty:
                return row.iloc[0].to_dict()
        from data.fund_meta_builder import _load_fund_meta
        meta_map = _load_fund_meta()
        m = meta_map.get(fund_id, {})
        if m:
            return {
                "fund_id": fund_id,
                "fund_name_cn": m.get("name", f"Fund #{fund_id}"),
                "sc_product_codes": m.get("code", ""),
                "sc_risk_rating": m.get("risk", ""),
            }
    except Exception:
        pass
    return {"fund_id": fund_id, "fund_name_cn": f"Fund #{fund_id}",
            "sc_product_codes": "", "sc_risk_rating": ""}


@st.cache_data(ttl=300)
def load_top_holdings(fund_id: int) -> pd.DataFrame:
    """从 fund_tagging.db 加载 Top 10 持仓"""
    try:
        conn = sqlite3.connect(TAG_DB)
        df = pd.read_sql("""
            SELECT holding_name_std, holding_name_raw, holding_type, weight_pct, rank
            FROM fund_holding_exposure
            WHERE fund_id = ?
              AND as_of_date = (
                  SELECT MAX(as_of_date) FROM fund_holding_exposure WHERE fund_id = ?
              )
            ORDER BY rank LIMIT 10
        """, conn, params=(fund_id, fund_id))
        conn.close()
        return df
    except Exception:
        return pd.DataFrame()


@st.cache_data(ttl=300)
def load_fund_tags(fund_id: int) -> pd.DataFrame:
    """从 fund_tagging.db 加载基金标签得分"""
    try:
        conn = sqlite3.connect(TAG_DB)
        df = pd.read_sql("""
            SELECT tt.tag_name, tt.category, ftm.aggregated_score, ftm.explanation
            FROM fund_tag_map ftm
            JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
            WHERE ftm.fund_id = ?
            ORDER BY ftm.aggregated_score DESC
        """, conn, params=(fund_id,))
        conn.close()
        return df
    except Exception:
        return pd.DataFrame()


@st.cache_data(ttl=60)
def load_nav_history(isin: str, ccy: str, start_date: str) -> pd.Series:
    """从 nav_history 加载净值历史（先 Supabase，再本地 SQLite）"""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_KEY", "")
    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)
            resp = (client.table("nav_history")
                    .select("nav_date,nav")
                    .eq("isin", isin).eq("ccy", ccy)
                    .gte("nav_date", start_date)
                    .order("nav_date").execute())
            if resp.data:
                df = pd.DataFrame(resp.data)
                df["nav_date"] = pd.to_datetime(df["nav_date"])
                return df.set_index("nav_date")["nav"].astype(float)
        except Exception:
            pass
    try:
        conn = sqlite3.connect(f"file:{NAV_DB}?mode=ro", uri=True)
        df = pd.read_sql("""
            SELECT nav_date, nav FROM nav_history
            WHERE isin=? AND ccy=? AND nav_date>=?
            ORDER BY nav_date
        """, conn, params=(isin, ccy, start_date))
        conn.close()
        if not df.empty:
            df["nav_date"] = pd.to_datetime(df["nav_date"])
            return df.set_index("nav_date")["nav"].astype(float)
    except Exception:
        pass
    return pd.Series(dtype=float)


def get_isin_from_code(code: str) -> tuple[str, str]:
    """从 fund_list 获取 ISIN 和 CCY"""
    if not (code or str(code).strip()):
        return "", "USD"
    try:
        conn = sqlite3.connect(f"file:{NAV_DB}?mode=ro", uri=True)
        clean_code = str(code).split(",")[0].strip()
        row = conn.execute(
            "SELECT isin, ccy FROM fund_list WHERE code=? LIMIT 1",
            (clean_code,)
        ).fetchone()
        conn.close()
        if row:
            return row[0], row[1]
    except Exception:
        pass
    return "", "USD"


def calc_period_return(series: pd.Series, days: int | None, label: str) -> dict:
    """计算区间收益率"""
    if series.empty:
        return {"区间": label, "收益率": "—", "起始净值": "—", "结束净值": "—"}
    today = date.today()
    if days is None:
        if label == "YTD":
            start = pd.Timestamp(today.year, 1, 1)
        else:
            start = series.index[0]
    else:
        start = pd.Timestamp(today - timedelta(days=days))

    sub = series[series.index >= start]
    if len(sub) < 2:
        return {"区间": label, "收益率": "—", "起始净值": "—", "结束净值": "—"}

    ret = (sub.iloc[-1] / sub.iloc[0] - 1) * 100
    return {
        "区间": label,
        "收益率": f"{ret:+.2f}%",
        "起始净值": f"{sub.iloc[0]:.4f}",
        "结束净值": f"{sub.iloc[-1]:.4f}",
    }


# ── 主渲染函数 ────────────────────────────────────────────────────
def render(fund_id: int, is_mobile: bool = False):
    meta = load_fund_meta(fund_id)
    name = meta.get("fund_name_cn", f"Fund #{fund_id}")
    code = meta.get("sc_product_codes", "")
    risk = meta.get("sc_risk_rating", "")
    tags_df = load_fund_tags(fund_id)
    holdings = load_top_holdings(fund_id)

    # ── 标题 ─────────────────────────────────────────────────────
    st.title(f"📋 {name}")
    if code or risk:
        st.caption(f"{code}  ·  {risk}")

    # ── 标签概览（前 5 个主题标签得分）────────────────────────────
    if not tags_df.empty:
        top_tags = tags_df.head(5)
        tag_html = " ".join([
            f"<span style='background:#185FA522;color:#185FA5;"
            f"padding:2px 10px;border-radius:12px;font-size:12px'>"
            f"{r['tag_name']} {r['aggregated_score']:.1f}%</span>"
            for _, r in top_tags.iterrows()
        ])
        st.markdown(tag_html, unsafe_allow_html=True)

    st.divider()

    # ── 业绩曲线（统一基准 100，区间切换）────────────────────────
    st.subheader("📈 历史业绩")
    isin, ccy = get_isin_from_code(code)

    if not isin:
        st.info("净值数据未关联（nav_history 中未找到对应 ISIN）。其他持仓与标签数据正常显示。")
    else:
        period_label = st.radio(
            "区间",
            list(PERIOD_MAP.keys()),
            index=4,
            horizontal=True,
            label_visibility="collapsed",
            key=f"period_{fund_id}",
        )
        days = PERIOD_MAP[period_label]
        today = date.today()
        if days is None:
            start_date = date(today.year, 1, 1).isoformat() if period_label == "YTD" else "2000-01-01"
        else:
            start_date = (today - timedelta(days=days)).isoformat()

        nav = load_nav_history(isin, ccy, start_date)

        if nav.empty:
            st.warning("暂无净值数据")
        else:
            nav_idx = nav / nav.iloc[0] * 100
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=nav_idx.index, y=nav_idx.values.round(2),
                name=name[:20],
                line=dict(color="#185FA5", width=2),
                hovertemplate="%{x|%Y-%m-%d}  %{y:.2f}<extra></extra>",
            ))
            fig.add_hline(y=100, line_dash="dash", line_color="#ccc", line_width=1)
            fig.update_layout(
                height=350 if is_mobile else 420,
                margin=dict(l=0, r=0, t=10, b=0),
                yaxis=dict(title="净值（基准=100）", gridcolor="#ebebeb"),
                xaxis=dict(gridcolor="#ebebeb"),
                plot_bgcolor="white", paper_bgcolor="white",
                hovermode="x",
            )
            st.plotly_chart(fig, use_container_width=True)

            # 区间收益率表（正绿负红）
            st.markdown("**区间收益率**")
            all_nav = load_nav_history(isin, ccy, "2000-01-01")
            periods = [
                ("YTD", None), ("1个月", 30), ("3个月", 90),
                ("6个月", 180), ("1年", 365), ("2年", 730),
                ("3年", 1095), ("5年", 1825),
            ]
            ret_rows = [calc_period_return(all_nav, d, l) for l, d in periods]
            ret_df = pd.DataFrame(ret_rows).set_index("区间")

            def color_ret(val):
                if isinstance(val, str) and val != "—":
                    if val.startswith("+"):
                        return "color:#0F6E56;font-weight:600"
                    if val.startswith("-"):
                        return "color:#A32D2D;font-weight:600"
                return ""

            if is_mobile:
                st.dataframe(ret_df[["收益率"]], use_container_width=True)
            else:
                st.dataframe(
                    ret_df.style.applymap(color_ret, subset=["收益率"]),
                    use_container_width=True,
                )

    st.divider()

    # ── Top 10 持仓 + 投资地区/板块 Pie Chart ─────────────────────
    if is_mobile:
        _render_holdings_mobile(holdings)
        _render_pie_charts(tags_df, is_mobile=True)
    else:
        col_left, col_right = st.columns([1, 1], gap="large")
        with col_left:
            _render_holdings_desktop(holdings)
        with col_right:
            _render_pie_charts(tags_df, is_mobile=False)


def _render_holdings_mobile(holdings: pd.DataFrame):
    st.subheader("🏦 Top 10 持仓")
    if holdings.empty:
        st.info("暂无持仓数据")
        return
    for _, row in holdings.iterrows():
        with st.container(border=True):
            c1, c2 = st.columns([3, 1])
            with c1:
                name = row.get("holding_name_raw") or row.get("holding_name_std", "")
                st.markdown(f"**{str(name)[:40]}**")
                st.caption(str(row.get("holding_type", "")).upper())
            with c2:
                st.metric("权重", f"{row.get('weight_pct', 0):.1f}%")


def _render_holdings_desktop(holdings: pd.DataFrame):
    st.subheader("🏦 Top 10 持仓")
    if holdings.empty:
        st.info("暂无持仓数据")
        return
    display = holdings.copy()
    display["持仓名称"] = (display.get("holding_name_raw") or display["holding_name_std"]).astype(str).str[:45]
    display["类型"] = display["holding_type"].astype(str).str.upper()
    display["权重%"] = display["weight_pct"].round(2)
    display["排名"] = display["rank"]
    st.dataframe(
        display[["排名", "持仓名称", "类型", "权重%"]],
        use_container_width=True, hide_index=True,
    )


def _render_pie_charts(tags_df: pd.DataFrame, is_mobile: bool = False):
    if tags_df.empty:
        return
    st.subheader("📊 投资分布")
    region_df = tags_df[tags_df["category"] == "region"].head(8)
    sector_df = tags_df[tags_df["category"] == "sector"].head(8)

    if is_mobile:
        if not region_df.empty:
            fig = px.pie(region_df, values="aggregated_score", names="tag_name",
                         title="投资地区", color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_layout(height=300, margin=dict(l=0, r=0, t=40, b=0))
            st.plotly_chart(fig, use_container_width=True)
        if not sector_df.empty:
            fig = px.pie(sector_df, values="aggregated_score", names="tag_name",
                         title="投资板块", color_discrete_sequence=px.colors.qualitative.Pastel)
            fig.update_layout(height=300, margin=dict(l=0, r=0, t=40, b=0))
            st.plotly_chart(fig, use_container_width=True)
    else:
        c1, c2 = st.columns(2)
        with c1:
            if not region_df.empty:
                fig = px.pie(region_df, values="aggregated_score", names="tag_name",
                             title="投资地区", color_discrete_sequence=px.colors.qualitative.Set2)
                fig.update_layout(height=320, margin=dict(l=0, r=0, t=40, b=0))
                st.plotly_chart(fig, use_container_width=True)
        with c2:
            if not sector_df.empty:
                fig = px.pie(sector_df, values="aggregated_score", names="tag_name",
                             title="投资板块", color_discrete_sequence=px.colors.qualitative.Pastel)
                fig.update_layout(height=320, margin=dict(l=0, r=0, t=40, b=0))
                st.plotly_chart(fig, use_container_width=True)
