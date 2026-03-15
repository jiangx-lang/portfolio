"""
pages/admin.py
管理后台 — 重新解析、查看标签库、手动打标
"""

import streamlit as st
from fund_tagging.db import get_conn


def render(is_mobile: bool = False):
    st.title("⚙️ 管理后台")

    tab1, tab2, tab3 = st.tabs(["标签库统计", "手动打标", "重新聚合"])

    # ── Tab 1: 统计 ───────────────────────────────────────────────
    with tab1:
        st.subheader("标签覆盖统计")
        conn = get_conn()

        col1, col2, col3 = st.columns(3)
        col1.metric("标签总数",   conn.execute("SELECT COUNT(*) FROM tag_taxonomy").fetchone()[0])
        col2.metric("持仓→标签",  conn.execute("SELECT COUNT(*) FROM holding_tag_map").fetchone()[0])
        col3.metric("基金→标签",  conn.execute("SELECT COUNT(*) FROM fund_tag_map").fetchone()[0])

        st.divider()
        st.markdown("**各标签基金覆盖数**")
        rows = conn.execute("""
            SELECT tt.tag_name, tt.category,
                   COUNT(DISTINCT ftm.fund_id) AS fund_count,
                   ROUND(AVG(ftm.aggregated_score), 2) AS avg_score
            FROM fund_tag_map ftm
            JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
            GROUP BY ftm.tag_id
            ORDER BY fund_count DESC
        """).fetchall()

        import pandas as pd
        df = pd.DataFrame([dict(r) for r in rows])
        df = df.rename(columns={
            "tag_name": "标签",
            "category": "类别",
            "fund_count": "基金数",
            "avg_score": "平均得分%",
        })
        st.dataframe(df, use_container_width=True, hide_index=True)
        conn.close()

    # ── Tab 2: 手动打标 ──────────────────────────────────────────
    with tab2:
        st.subheader("手动给持仓打标签")
        st.caption("优先级高于规则，用于纠错或补充")

        conn = get_conn()
        all_tags = [r["tag_name"] for r in
                    conn.execute("SELECT tag_name FROM tag_taxonomy ORDER BY tag_name")]
        conn.close()

        holding = st.text_input("持仓名称（标准化后）", placeholder="NVIDIA")
        tag     = st.selectbox("标签", [""] + all_tags)
        conf    = st.slider("置信度", 0.5, 1.0, 0.95, step=0.05)

        if st.button("添加映射", type="primary"):
            if holding and tag:
                conn = get_conn()
                tag_id = conn.execute(
                    "SELECT tag_id FROM tag_taxonomy WHERE tag_name=?", (tag,)
                ).fetchone()
                if tag_id:
                    conn.execute("""
                        INSERT INTO holding_tag_map(holding_name_std, tag_id, confidence_score, source)
                        VALUES(?,?,?,'manual')
                        ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET
                            confidence_score=excluded.confidence_score,
                            source='manual'
                    """, (holding.upper(), tag_id["tag_id"], conf))
                    conn.commit()
                    st.success(f"已添加：{holding.upper()} → {tag}（conf={conf}）")
                conn.close()
            else:
                st.warning("请填写持仓名称并选择标签")

    # ── Tab 3: 重新聚合 ──────────────────────────────────────────
    with tab3:
        st.subheader("重新聚合基金标签")
        st.caption("在新增/修改 holding_tag_map 后运行")

        if st.button("开始重新聚合", type="primary"):
            from fund_tagging.aggregation import recalculate_all_funds
            with st.spinner("聚合中..."):
                total = recalculate_all_funds()
            st.success(f"完成！写入 {total} 条 fund_tag_map 记录")
