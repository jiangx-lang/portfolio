"""
pages/miss_log.py
未命中主题记录 — 展示 + 批量 AI 分析
"""

import streamlit as st
from data.miss_store import get_miss_log, clear_miss_log, delete_miss_entry


def render(is_mobile: bool = False):
    st.title("📋 未命中主题记录")
    st.caption("用户搜索但系统未匹配的主题关键词，用于优化标签库")

    log = get_miss_log()

    if not log:
        st.success("暂无未命中记录")
        return

    # ── 统计 ────────────────────────────────────────────────────
    col1, col2 = st.columns(2)
    col1.metric("未命中总数", len(log))
    col2.metric("独立关键词", len({e["query"] for e in log}))

    st.divider()

    # ── 批量操作 ─────────────────────────────────────────────────
    c1, c2 = st.columns([2, 1])
    with c1:
        if st.button("🤖  批量 AI 分析所有未命中主题", type="primary"):
            keywords = "、".join(sorted({e["query"] for e in log}))
            st.session_state["_ai_prompt"] = (
                f"以下是用户搜索但未匹配到标签的主题关键词：【{keywords}】\n\n"
                "请分析：\n"
                "1. 这些主题各对应哪些渣打QDII基金（从已有基金库中匹配）？\n"
                "2. 建议新增哪些条目到 tag_taxonomy？（tag_name, category, aliases）\n"
                "3. 对应的 holding_tag_map 规则（regex pattern → tag_name）是什么？\n"
                "4. 哪些主题确实没有匹配基金，需要产品层面补充？"
            )
            st.info("已生成分析请求，复制下方内容发给 AI：")
            st.code(st.session_state["_ai_prompt"], language=None)

    with c2:
        if st.button("🗑️  清空记录", type="secondary"):
            clear_miss_log()
            st.rerun()

    st.divider()

    # ── 逐条展示 ─────────────────────────────────────────────────
    for entry in sorted(log, key=lambda x: x["ts"], reverse=True):
        c1, c2, c3, c4 = st.columns([3, 2, 2, 1])
        with c1:
            st.markdown(f"**{entry['query']}**")
        with c2:
            st.caption(entry["ts"])
        with c3:
            st.caption(f"来源: {entry.get('source', 'search')}")
        with c4:
            if st.button("删除", key=f"del_{entry['id']}"):
                delete_miss_entry(entry["id"])
                st.rerun()
