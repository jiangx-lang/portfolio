"""
pages/theme_search.py
主题基金搜索 — 手机/电脑双布局
"""

import streamlit as st
from fund_tagging.db import get_conn
from data.tag_aliases import TAG_ALIASES, PRESET_THEMES
from data.miss_store import log_miss

TAG_COLORS = {
    "HALO":"#185FA5","AI Hardware":"#534AB7","AI Software":"#7F77DD",
    "AI Infrastructure":"#534AB7","Semiconductor":"#7F77DD",
    "Cloud/SaaS":"#AFA9EC","China Internet":"#993C1D","Asia":"#0F6E56",
    "US":"#185FA5","Income/Dividend":"#854F0B","Quality":"#3B6D11",
    "Mega Cap":"#444441","Technology":"#185FA5","Bond":"#888780",
    "Low Vol":"#0F6E56","Defense":"#444441","Energy Transition":"#3B6D11",
    "Gold":"#BA7517","Infrastructure":"#854F0B","Robotics":"#534AB7",
    "EV":"#0F6E56","Healthcare":"#993C1D","Real Estate":"#854F0B",
    "China":"#993C1D","Emerging Markets":"#0F6E56",
}
RISK_COLORS = {
    "保守型":"#0F6E56","稳健型":"#185FA5",
    "适度积极型":"#854F0B","积极型":"#993C1D","非常积极型":"#A32D2D",
}


@st.cache_data(ttl=300)
def load_funds() -> list[dict]:
    from data.fund_meta_builder import _load_fund_meta
    conn = get_conn()
    rows = conn.execute("""
        SELECT ftm.fund_id,
               GROUP_CONCAT(DISTINCT tt.tag_name) AS tags,
               GROUP_CONCAT(tt.tag_name||'='||ROUND(ftm.aggregated_score,2),'|') AS score_pairs
        FROM fund_tag_map ftm
        JOIN tag_taxonomy tt ON tt.tag_id=ftm.tag_id
        GROUP BY ftm.fund_id
    """).fetchall()
    holding_rows = conn.execute("""
        SELECT fund_id, holding_name_std, weight_pct
        FROM fund_holding_exposure fhe
        WHERE weight_pct=(SELECT MAX(fhe2.weight_pct) FROM fund_holding_exposure fhe2 WHERE fhe2.fund_id=fhe.fund_id)
           OR weight_pct>=(SELECT MAX(fhe3.weight_pct)*0.6 FROM fund_holding_exposure fhe3 WHERE fhe3.fund_id=fhe.fund_id)
        ORDER BY fund_id, weight_pct DESC
    """).fetchall()
    conn.close()
    top_map: dict[int, list] = {}
    for h in holding_rows:
        top_map.setdefault(h["fund_id"], []).append(f"{h['holding_name_std']} {h['weight_pct']:.1f}%")
    fund_meta = _load_fund_meta()
    funds = []
    for r in rows:
        fid = r["fund_id"]
        meta = fund_meta.get(fid, {})
        score_pairs = {}
        for pair in (r["score_pairs"] or "").split("|"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                try: score_pairs[k.strip()] = float(v)
                except ValueError: pass
        funds.append({
            "fund_id": fid,
            "name":    meta.get("name", f"Fund #{fid}"),
            "code":    meta.get("code", ""),
            "risk":    meta.get("risk", ""),
            "tags":    [t.strip() for t in (r["tags"] or "").split(",") if t.strip()],
            "scores":  score_pairs,
            "top":     top_map.get(fid, [])[:3],
        })
    return funds


def resolve_query(query: str) -> list[str]:
    lower = query.strip().lower()
    if not lower:
        return []
    resolved = []
    for alias, tags in TAG_ALIASES.items():
        if lower == alias.lower() or lower in alias.lower() or alias.lower() in lower:
            resolved.extend(tags)
    if not resolved:
        conn = get_conn()
        all_tags = [r["tag_name"] for r in conn.execute("SELECT tag_name FROM tag_taxonomy")]
        conn.close()
        for t in all_tags:
            if lower in t.lower() or t.lower() in lower:
                resolved.append(t)
    return list(dict.fromkeys(resolved))


def score_fund(fund: dict, tags: list[str]) -> float:
    if not tags:
        return sum(fund["scores"].values())
    return sum(fund["scores"].get(t, 0) for t in tags)


def find_similar(query: str) -> list[str]:
    lower = query.lower()
    candidates = list(TAG_ALIASES.keys()) + [p["label"] for p in PRESET_THEMES]
    return [c for c in candidates if lower in c.lower() or c.lower() in lower][:4]


# ── 手机端渲染 ────────────────────────────────────────────────────
def _render_mobile(funds, active_tags, query, miss_mode):
    # 预设主题：2列
    st.markdown("**预设主题**")
    cols2 = [PRESET_THEMES[i:i+2] for i in range(0, len(PRESET_THEMES), 2)]
    for pair in cols2:
        c1, c2 = st.columns(2)
        for col, p in zip([c1, c2], pair):
            with col:
                if st.button(p["label"], key=f"mp_{p['label']}",
                             type="primary" if active_tags == p["tags"] else "secondary",
                             use_container_width=True):
                    st.session_state["active_tags"]     = p["tags"]
                    st.session_state["search_query"]    = p["label"]
                    st.session_state["selected_preset"] = p["label"]
                    st.session_state["miss_mode"]       = False
                    st.rerun()

    # 搜索框
    query_input = st.text_input("搜索主题", value=query,
                                placeholder="输入关键词...",
                                label_visibility="collapsed")
    if st.button("搜索", type="primary", use_container_width=True):
        resolved = resolve_query(query_input)
        st.session_state["search_query"] = query_input
        if resolved:
            st.session_state["active_tags"] = resolved
            st.session_state["miss_mode"] = False
        else:
            st.session_state["active_tags"] = []
            st.session_state["miss_mode"] = True
            log_miss(query_input)
        st.rerun()

    # 未命中
    if miss_mode and query:
        similar = find_similar(query)
        with st.warning(f"「{query}」未匹配到标签"):
            if similar:
                st.write("相近：" + " / ".join(similar))
            if st.button("提交给团队", key="m_miss_submit"):
                st.success("已记录")

    # 结果：单列卡片
    scored = [(f, score_fund(f, active_tags)) for f in funds]
    scored = [(f, s) for f, s in scored if s > 0 or not active_tags]
    scored.sort(key=lambda x: -x[1])

    st.markdown(f"**{len(scored)} 只基金**")
    for fund, total_score in scored[:20]:
        risk_color = RISK_COLORS.get(fund["risk"], "#888")
        with st.container(border=True):
            st.markdown(
                f"**{fund['name']}**  "
                f"<span style='font-size:11px;color:{risk_color}'>● {fund['risk']}</span>",
                unsafe_allow_html=True,
            )
            # 得分 + 主要标签（2列）
            mc1, mc2 = st.columns(2)
            with mc1:
                st.metric("主题得分", f"{total_score:.1f}%")
            with mc2:
                top_tag = sorted(fund["scores"].items(), key=lambda x: -x[1])
                if top_tag:
                    t, s = top_tag[0]
                    color = TAG_COLORS.get(t, "#888")
                    st.markdown(
                        f"<span style='background:{color}22;color:{color};"
                        f"padding:2px 8px;border-radius:10px;font-size:12px'>"
                        f"{t} {s:.0f}%</span>",
                        unsafe_allow_html=True,
                    )
            # 持仓（折叠）
            if fund["top"]:
                with st.expander("主要持仓"):
                    st.caption(" · ".join(h[:30] for h in fund["top"]))


# ── 电脑端渲染 ────────────────────────────────────────────────────
def _render_desktop(funds, active_tags, query, miss_mode):
    # 预设主题：8列
    st.markdown("**预设主题**")
    cols8 = st.columns(min(8, len(PRESET_THEMES)))
    for i, p in enumerate(PRESET_THEMES):
        with cols8[i % 8]:
            if st.button(p["label"], key=f"dp_{p['label']}",
                         type="primary" if active_tags == p["tags"] else "secondary",
                         use_container_width=True):
                st.session_state["active_tags"]     = p["tags"]
                st.session_state["search_query"]    = p["label"]
                st.session_state["selected_preset"] = p["label"]
                st.session_state["miss_mode"]       = False
                st.rerun()

    st.divider()

    # 搜索框
    col_in, col_btn = st.columns([5, 1])
    with col_in:
        query_input = st.text_input("搜索", value=query,
                                    placeholder="输入主题关键词...",
                                    label_visibility="collapsed")
    with col_btn:
        search_clicked = st.button("搜索", type="primary", use_container_width=True)

    if search_clicked and query_input:
        resolved = resolve_query(query_input)
        st.session_state["search_query"] = query_input
        if resolved:
            st.session_state["active_tags"] = resolved
            st.session_state["miss_mode"] = False
        else:
            st.session_state["active_tags"] = []
            st.session_state["miss_mode"] = True
            log_miss(query_input)
        st.rerun()

    # 未命中
    if miss_mode and query:
        similar = find_similar(query)
        with st.warning(f"「{query}」未匹配到标签"):
            if similar:
                st.write("您是否在找：" + " · ".join(similar))
            if st.button("提交给团队", key="d_miss_submit"):
                st.success("已记录")

    # 结果：表格
    scored = [(f, score_fund(f, active_tags)) for f in funds]
    scored = [(f, s) for f, s in scored if s > 0 or not active_tags]
    scored.sort(key=lambda x: -x[1])

    st.markdown(f"**{len(scored)} 只基金**")
    hcols = st.columns([3, 1.5, 1.2, 3, 2.5])
    for col, h in zip(hcols, ["基金", "代码", "主题得分", "标签", "主要持仓"]):
        col.markdown(f"<span style='font-size:12px;color:gray'>{h}</span>",
                     unsafe_allow_html=True)
    st.divider()

    for fund, total_score in scored[:30]:
        c1, c2, c3, c4, c5 = st.columns([3, 1.5, 1.2, 3, 2.5])
        risk_color = RISK_COLORS.get(fund["risk"], "#888")
        with c1:
            st.markdown(
                f"**{fund['name']}**  "
                f"<span style='font-size:11px;color:{risk_color}'>● {fund['risk']}</span>",
                unsafe_allow_html=True,
            )
        with c2:
            st.code(fund["code"][:12] if fund["code"] else "—", language=None)
        with c3:
            bar_pct = min(int(total_score / 50 * 100), 100)
            color   = TAG_COLORS.get(active_tags[0] if active_tags else "", "#185FA5")
            st.markdown(f"**{total_score:.1f}%**")
            st.markdown(
                f"<div style='background:#eee;border-radius:2px;height:4px;width:80px'>"
                f"<div style='width:{bar_pct}%;height:4px;background:{color};border-radius:2px'></div></div>",
                unsafe_allow_html=True,
            )
        with c4:
            top_tags = sorted(fund["scores"].items(), key=lambda x: -x[1])[:4]
            chip_parts = []
            for t, s in top_tags:
                color  = TAG_COLORS.get(t, "#888")
                border = f"border:0.5px solid {color};" if t in active_tags else ""
                chip_parts.append(
                    f"<span style='background:{color}22;color:{color};"
                    f"padding:1px 7px;border-radius:10px;font-size:11px;{border}'>"
                    f"{t} {s:.0f}%</span>"
                )
            st.markdown(" ".join(chip_parts), unsafe_allow_html=True)
        with c5:
            st.caption(" · ".join(h[:25] for h in fund["top"][:2]))
        st.divider()


# ── 主入口 ────────────────────────────────────────────────────────
def render(is_mobile: bool = False):
    st.title("🔍 主题基金搜索")

    funds      = load_funds()
    query      = st.session_state.get("search_query", "")
    active_tags = st.session_state.get("active_tags", [])
    miss_mode  = st.session_state.get("miss_mode", False)

    if is_mobile:
        _render_mobile(funds, active_tags, query, miss_mode)
    else:
        _render_desktop(funds, active_tags, query, miss_mode)
