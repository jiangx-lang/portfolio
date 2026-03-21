"""
pages/theme_search.py
主题基金搜索 — 手机/电脑双布局

基金列表数据源与 Next.js /api/qd/funds 对齐：以 fund_holding_exposure 为基准；
fund_tag_map 仅补充主题得分（无打标时仍展示基金，主题得分为空）。
"""

import sqlite3

import streamlit as st
from fund_tagging.db import get_conn
from data.tag_aliases import TAG_ALIASES, PRESET_THEMES
from data.miss_store import log_miss

TAG_COLORS = {
    "HALO":"#185FA5","AI Hardware":"#534AB7","AI Software":"#7F77DD",
    "AI Infrastructure":"#534AB7","Semiconductor":"#7F77DD",
    "Cloud/SaaS":"#AFA9EC","China Internet":"#993C1D","Asia":"#0F6E56",
    "US":"#185FA5","Income/Dividend":"#854F0B","HighDividend":"#854F0B","Quality":"#3B6D11",
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
    fund_meta = _load_fund_meta()

    # ── 与 mf-holdings-dashboard /api/qd/funds 一致：基金清单来自持仓表 ──
    _base_sql = """
        SELECT fund_id,
               fund_name_cn,
               MIN(COALESCE(primary_code, sc_product_code)) AS code,
               MIN(primary_code) AS primary_code,
               MIN(sc_product_code) AS sc_product_code
        FROM fund_holding_exposure
        WHERE fund_name_cn IS NOT NULL
          AND (primary_code IS NOT NULL OR sc_product_code IS NOT NULL)
        GROUP BY fund_id, fund_name_cn
        ORDER BY fund_name_cn
    """
    try:
        base_rows = list(conn.execute(_base_sql))
    except sqlite3.OperationalError:
        # 旧库无 fund_name_cn / primary_code 等列时退回
        base_rows = list(
            conn.execute(
                "SELECT DISTINCT fund_id AS fund_id FROM fund_holding_exposure ORDER BY fund_id"
            )
        )

    print(f"[theme_search] load_funds: fund_holding_exposure 基准行数 = {len(base_rows)}")

    # 按 fund_id 去重（同一 id 多行时保留首条）
    by_fid: dict[int, sqlite3.Row] = {}
    for row in base_rows:
        fid = int(row["fund_id"])
        if fid not in by_fid:
            by_fid[fid] = row
    base_list = list(by_fid.values())

    # ── 主题得分仅来自 fund_tag_map（可能为空，与「0 只基金」根因无关）──
    _tag_sql_active = """
        SELECT ftm.fund_id,
               GROUP_CONCAT(DISTINCT tt.tag_name) AS tags,
               GROUP_CONCAT(tt.tag_name||'='||ROUND(ftm.aggregated_score,2),'|') AS score_pairs
        FROM fund_tag_map ftm
        JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id AND COALESCE(tt.is_active, 1) = 1
        GROUP BY ftm.fund_id
    """
    _tag_sql_plain = """
        SELECT ftm.fund_id,
               GROUP_CONCAT(DISTINCT tt.tag_name) AS tags,
               GROUP_CONCAT(tt.tag_name||'='||ROUND(ftm.aggregated_score,2),'|') AS score_pairs
        FROM fund_tag_map ftm
        JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
        GROUP BY ftm.fund_id
    """
    try:
        tag_rows = list(conn.execute(_tag_sql_active))
    except sqlite3.OperationalError:
        tag_rows = list(conn.execute(_tag_sql_plain))

    print(f"[theme_search] load_funds: fund_tag_map 有标签的基金数 = {len(tag_rows)}")

    tag_by_fid = {int(r["fund_id"]): r for r in tag_rows}

    holding_rows = conn.execute("""
        SELECT fund_id, holding_name_std, weight_pct
        FROM fund_holding_exposure fhe
        WHERE weight_pct=(SELECT MAX(fhe2.weight_pct) FROM fund_holding_exposure fhe2 WHERE fhe2.fund_id=fhe.fund_id)
           OR weight_pct>=(SELECT MAX(fhe3.weight_pct)*0.6 FROM fund_holding_exposure fhe3 WHERE fhe3.fund_id=fhe.fund_id)
        ORDER BY fund_id, weight_pct DESC
    """).fetchall()
    conn.close()

    print(f"[theme_search] load_funds: holding 辅助行数 = {len(holding_rows)}")

    top_map: dict[int, list] = {}
    for h in holding_rows:
        top_map.setdefault(h["fund_id"], []).append(f"{h['holding_name_std']} {h['weight_pct']:.1f}%")

    def _row_name_code(r: sqlite3.Row, fid: int) -> tuple[str, str]:
        meta = fund_meta.get(fid, {})
        keys = r.keys()
        name = (
            (r["fund_name_cn"] if "fund_name_cn" in keys and r["fund_name_cn"] else None)
            or meta.get("name")
            or f"Fund #{fid}"
        )
        code = ""
        if "code" in keys and r["code"]:
            code = str(r["code"])
        elif "primary_code" in keys and r["primary_code"]:
            code = str(r["primary_code"])
        elif "sc_product_code" in keys and r["sc_product_code"]:
            code = str(r["sc_product_code"])
        else:
            code = meta.get("code", "") or ""
        return name, code

    funds: list[dict] = []
    for r in sorted(
        base_list,
        key=lambda x: _row_name_code(x, int(x["fund_id"]))[0].lower(),
    ):
        fid = int(r["fund_id"])
        meta = fund_meta.get(fid, {})
        name, code = _row_name_code(r, fid)
        tr = tag_by_fid.get(fid)
        tags_raw = (tr["tags"] if tr else "") or ""
        score_pairs: dict[str, float] = {}
        if tr and tr["score_pairs"]:
            for pair in str(tr["score_pairs"]).split("|"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    try:
                        score_pairs[k.strip()] = float(v)
                    except ValueError:
                        pass
        funds.append({
            "fund_id": fid,
            "name": name,
            "code": code,
            "risk": meta.get("risk", ""),
            "tags": [t.strip() for t in tags_raw.split(",") if t.strip()],
            "scores": score_pairs,
            "top": top_map.get(fid, [])[:3],
        })

    print(f"[theme_search] load_funds: 最终返回 funds 长度 = {len(funds)}")
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
            if st.button("查看详情 →", key=f"m_detail_{fund['fund_id']}",
                         use_container_width=True):
                st.session_state["qdii_fund_detail_id"] = fund["fund_id"]
                st.rerun()


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
    hcols = st.columns([3, 1.5, 1.2, 3, 2, 1])
    for col, h in zip(hcols, ["基金", "代码", "主题得分", "标签", "主要持仓", ""]):
        col.markdown(f"<span style='font-size:12px;color:gray'>{h}</span>",
                     unsafe_allow_html=True)
    st.divider()

    for fund, total_score in scored[:30]:
        c1, c2, c3, c4, c5, c6 = st.columns([3, 1.5, 1.2, 3, 2, 1])
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
        with c6:
            if st.button("详情", key=f"detail_{fund['fund_id']}",
                         use_container_width=True):
                st.session_state["qdii_fund_detail_id"] = fund["fund_id"]
                st.rerun()
        st.divider()


# ── 主入口 ────────────────────────────────────────────────────────
def render(is_mobile: bool = False):
    st.markdown(
        '<style>[data-testid="baseButton-secondary"],[data-testid="baseButton-primary"]'
        "{background:#0f2744!important;color:#60a5fa!important;border:1px solid #3b82f6!important}"
        "</style>",
        unsafe_allow_html=True,
    )
    st.title("🔍 主题基金搜索")

    funds = load_funds()
    st.caption(
        f"已加载 **{len(funds)}** 只基金（分步计数见运行 Streamlit 的终端：`[theme_search] load_funds:`）"
    )
    query = st.session_state.get("search_query", "")
    active_tags = st.session_state.get("active_tags", [])
    miss_mode  = st.session_state.get("miss_mode", False)

    if is_mobile:
        _render_mobile(funds, active_tags, query, miss_mode)
    else:
        _render_desktop(funds, active_tags, query, miss_mode)
