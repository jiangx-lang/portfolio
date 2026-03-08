# -*- coding: utf-8 -*-
"""
机构标准 vs 个人配置：双饼图对比、备注穿透、关联观点
- 左：机构标准配比（portfolio_templates 平衡型）
- 右：个人持仓聚合饼图 + 年化收入测算 + 穿透明细（remarks）
- 合规：页面标题/描述中「渣打」动态替换为「机构」
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

DB_PATH = Path(r"d:\house view\scb_reports.db")
PORTFOLIO_TYPE = "平衡型"
FEE_DEFAULT = 0.005

# 资产类别 -> 关联观点检索用 tags（逗号分隔，用于 LIKE）
ASSET_CLASS_TAGS: dict[str, list[str]] = {
    "全球股票": ["US", "Japan"],
    "DM投资级债券": [],
    "黄金": ["Gold"],
}


def _t(s: str) -> str:
    """合规脱敏：渣打 -> 机构"""
    return (s or "").replace("渣打", "机构")


def get_conn():
    if not DB_PATH.exists():
        return None
    return sqlite3.connect(DB_PATH)


def fetch_benchmark(conn: sqlite3.Connection) -> pd.DataFrame:
    """机构标准配比：平衡型 standard_weight"""
    df = pd.read_sql_query(
        "SELECT asset_class AS 资产类别, standard_weight AS 占比 FROM portfolio_templates WHERE portfolio_type = ? ORDER BY standard_weight DESC",
        conn,
        params=(PORTFOLIO_TYPE,),
    )
    return df


def fetch_user_holdings(conn: sqlite3.Connection) -> pd.DataFrame:
    """个人持仓明细（含 remarks）"""
    df = pd.read_sql_query(
        """SELECT asset_class AS 资产类别, product_name AS 产品名称, weight AS 权重, fee_rate AS 费率, remarks AS 备注
           FROM user_portfolio_holdings WHERE portfolio_type = ? ORDER BY asset_class, product_name""",
        conn,
        params=(PORTFOLIO_TYPE,),
    )
    return df


def fetch_revenue_factor(conn: sqlite3.Connection) -> float:
    """总预计年化收入因子：SUM(standard_weight * weight * COALESCE(fee_rate, 0.005))"""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT SUM(t.standard_weight * h.weight * COALESCE(h.fee_rate, ?))
        FROM user_portfolio_holdings h
        JOIN portfolio_templates t ON h.portfolio_type = t.portfolio_type AND h.asset_class = t.asset_class
        WHERE h.portfolio_type = ?
        """,
        (FEE_DEFAULT, PORTFOLIO_TYPE),
    )
    row = cur.fetchone()
    return float(row[0] or 0)


def fetch_related_views(conn: sqlite3.Connection, asset_classes: list[str], limit: int = 5) -> list[tuple[str, str]]:
    """根据当前持仓的 asset_class 对应 tags，检索 report_segments 中带相同 tags 的最新观点。返回 (content, tags) 列表。"""
    tags_to_match = []
    for ac in asset_classes:
        tags_to_match.extend(ASSET_CLASS_TAGS.get(ac, []))
    tags_to_match = list(dict.fromkeys(tags_to_match))
    if not tags_to_match:
        return []
    cur = conn.cursor()
    # LIKE '%US%' OR LIKE '%Japan%' ...
    conditions = " OR ".join(["tags LIKE ?" for _ in tags_to_match])
    params = [f"%{t}%" for t in tags_to_match] + [limit]
    cur.execute(
        f"SELECT content, COALESCE(tags, '') FROM report_segments WHERE tags IS NOT NULL AND TRIM(tags) != '' AND ({conditions}) ORDER BY id DESC LIMIT ?",
        params,
    )
    return cur.fetchall()


def main():
    st.set_page_config(page_title=_t("机构标准 vs 个人配置"), layout="centered")
    st.title(_t("机构标准 vs 个人配置"))
    st.caption(_t("左：机构建议配比（平衡型）｜右：个人持仓聚合与收入测算"))

    conn = get_conn()
    if not conn:
        st.error(f"数据库不存在: {DB_PATH}")
        return

    try:
        bench = fetch_benchmark(conn)
        holdings = fetch_user_holdings(conn)
        revenue_factor = fetch_revenue_factor(conn)
        asset_classes = holdings["资产类别"].unique().tolist() if not holdings.empty else []
        related_views = fetch_related_views(conn, asset_classes) if asset_classes else []
    finally:
        conn.close()

    if bench.empty:
        st.warning("未找到机构标准配比（平衡型），请先执行 scb_db_migrate.py 初始化。")
        return

    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.subheader(_t("机构标准配比（Benchmark）"))
        fig_left = px.pie(
            bench,
            values="占比",
            names="资产类别",
            title="",
            hole=0.4,
        )
        fig_left.update_traces(textposition="inside", textinfo="percent+label")
        st.plotly_chart(fig_left, use_container_width=True)

    with col_right:
        st.subheader("个人配置（User Portfolio）")
        if holdings.empty:
            st.info("暂无个人持仓数据。")
        else:
            # 按资产类别聚合权重（累加）
            agg = holdings.groupby("资产类别", as_index=False).agg({"权重": "sum"})
            total_w = agg["权重"].sum()
            if total_w <= 0:
                st.warning("持仓权重合计为 0。")
            else:
                agg["占比"] = agg["权重"] / total_w
                fig_right = px.pie(
                    agg,
                    values="占比",
                    names="资产类别",
                    title="",
                    hole=0.4,
                )
                fig_right.update_traces(textposition="inside", textinfo="percent+label")
                st.plotly_chart(fig_right, use_container_width=True)

            # 年化收入测算：Total_Revenue = AUM * SUM(Amount占比 * weight * fee_rate)，此处用 revenue_factor
            aum = st.number_input("假设组合规模 AUM（元）", min_value=0, value=1_000_000, step=50_000)
            total_revenue = aum * revenue_factor
            st.metric(
                "总预计年化收入（Revenue）",
                f"¥ {total_revenue:,.2f}",
                help="公式: Total_Revenue = AUM × Σ(standard_weight × weight × fee_rate)，费率空按 0.5%",
            )

    # 备注穿透：按资产类别展示构成与 remarks
    st.subheader("持仓穿透明细")
    if not holdings.empty:
        for asset_class in holdings["资产类别"].unique():
            sub = holdings[holdings["资产类别"] == asset_class]
            total_class = sub["权重"].sum()
            # 展示为「基金 A 10% + 基金 B 10%」并带备注
            parts = []
            for _, r in sub.iterrows():
                pct = r["权重"] * 100
                parts.append(f"{r['产品名称']} {pct:.1f}%")
            summary = " + ".join(parts)
            remarks_list = sub["备注"].dropna().unique().tolist()
            remarks_str = "；".join(str(x) for x in remarks_list) if remarks_list else "—"
            with st.expander(f"**{asset_class}** — {summary}"):
                st.caption("构成")
                st.write(summary)
                st.caption("备注（来自数据库 remarks）")
                st.write(remarks_str)
                st.dataframe(
                    sub[["产品名称", "权重", "费率", "备注"]].rename(columns={"权重": "权重(占该类别)", "费率": "年化费率"}),
                    hide_index=True,
                    use_container_width=True,
                )
    else:
        st.info("暂无持仓，无法展示穿透。")

    # 关联观点：按当前持仓的 asset_class 对应 tags 检索 report_segments
    st.subheader("关联观点")
    if related_views:
        for content, tags in related_views:
            with st.container(border=True):
                st.caption(f"Tags: {tags}")
                st.write(content[:500] + "…" if len(content) > 500 else content)
    else:
        st.caption("当前持仓对应 tags 下暂无报告观点，或 report_segments 中无匹配 tags。")


if __name__ == "__main__":
    main()
