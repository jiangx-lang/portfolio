"""
pages/portfolio_builder.py
组合构建器 — 手机/电脑双布局
"""

import streamlit as st
from data.tag_aliases import PRESET_THEMES
from data.benchmarks import BENCHMARKS

TAG_COLORS = {
    "HALO":"#185FA5","AI Hardware":"#534AB7","AI Software":"#7F77DD",
    "AI Infrastructure":"#534AB7","Semiconductor":"#7F77DD",
    "Cloud/SaaS":"#AFA9EC","China Internet":"#993C1D","Asia":"#0F6E56",
    "US":"#185FA5","Income/Dividend":"#854F0B","Quality":"#3B6D11",
    "Mega Cap":"#444441","Technology":"#185FA5","Bond":"#888780",
    "Low Vol":"#0F6E56",
}
RISK_COLORS = {
    "保守型":"#0F6E56","稳健型":"#185FA5",
    "适度积极型":"#854F0B","积极型":"#993C1D","非常积极型":"#A32D2D",
}


@st.cache_data(ttl=300)
def load_fund_list() -> list[dict]:
    from pages.theme_search import load_funds
    return load_funds()


def _init_portfolio():
    if "portfolio" not in st.session_state:
        st.session_state["portfolio"] = [
            {"fund_id": None, "weight": 20} for _ in range(5)
        ]


def _apply_theme(preset: dict, all_funds: list[dict]):
    tag_list = preset["tags"]
    scored = sorted(
        [(f, sum(f["scores"].get(t, 0) for t in tag_list)) for f in all_funds],
        key=lambda x: -x[1]
    )
    top5    = [f for f, s in scored[:5] if s > 0]
    weights = [25, 25, 20, 20, 10][:len(top5)]
    if top5 and sum(weights) != 100:
        weights[-1] += 100 - sum(weights)
    new_p = [{"fund_id": None, "weight": 0}] * 5
    for i, (fund, w) in enumerate(zip(top5, weights)):
        new_p[i] = {"fund_id": fund["fund_id"], "weight": w}
    st.session_state["portfolio"] = new_p


def _equal_weight():
    active = [s for s in st.session_state["portfolio"] if s["fund_id"]]
    n = len(active)
    if not n:
        return
    base = 100 // n
    rem  = 100 - base * n
    for slot in st.session_state["portfolio"]:
        if slot["fund_id"]:
            slot["weight"] = base + (1 if rem > 0 else 0)
            rem -= 1
        else:
            slot["weight"] = 0


def aggregate_portfolio(slots: list[dict]) -> dict[str, float]:
    total_w = sum(s["weight"] for s in slots)
    if total_w == 0:
        return {}
    agg: dict[str, float] = {}
    for s in slots:
        w = s["weight"] / total_w
        for tag, sc in s["fund"]["scores"].items():
            agg[tag] = agg.get(tag, 0) + sc * w
    return agg


# ── 手机端 ────────────────────────────────────────────────────────
def _render_mobile(all_funds):
    fund_options = {f["name"]: f["fund_id"] for f in all_funds}
    fund_by_id   = {f["fund_id"]: f for f in all_funds}

    # 主题快选：2列
    st.markdown("**快速主题**")
    theme_pairs = [PRESET_THEMES[:6][i:i+2] for i in range(0, 6, 2)]
    for pair in theme_pairs:
        c1, c2 = st.columns(2)
        for col, p in zip([c1, c2], pair):
            with col:
                if st.button(p["label"], key=f"mt_{p['label']}",
                             use_container_width=True):
                    _apply_theme(p, all_funds)
                    st.rerun()

    st.divider()

    # 持仓选择：单列，带折叠
    st.markdown("**选择基金**")
    total_weight = 0
    for i, slot in enumerate(st.session_state["portfolio"]):
        fid  = slot["fund_id"]
        name = fund_by_id[fid]["name"] if fid and fid in fund_by_id else ""
        with st.container(border=True):
            chosen = st.selectbox(
                f"仓位 {i+1}",
                options=[""] + list(fund_options.keys()),
                index=(list(fund_options.keys()).index(name) + 1
                       if name in fund_options else 0),
                key=f"ms_fund_{i}",
                label_visibility="collapsed",
            )
            st.session_state["portfolio"][i]["fund_id"] = fund_options.get(chosen)
            wc1, wc2 = st.columns([3, 1])
            with wc1:
                new_w = st.slider("权重", 0, 100, int(slot["weight"]),
                                  step=5, key=f"ms_w_{i}",
                                  label_visibility="collapsed")
            with wc2:
                st.markdown(f"<div style='padding-top:8px;font-weight:600'>{new_w}%</div>",
                            unsafe_allow_html=True)
            st.session_state["portfolio"][i]["weight"] = new_w
            total_weight += new_w

    wcolor = "green" if total_weight == 100 else ("red" if total_weight > 100 else "orange")
    st.markdown(f"权重合计：<span style='color:{wcolor};font-weight:600'>{total_weight}%</span>",
                unsafe_allow_html=True)
    if st.button("均分权重", key="m_eq", use_container_width=True):
        _equal_weight(); st.rerun()

    # 组合特征：2×2
    active_slots = [
        {"fund": fund_by_id[s["fund_id"]], "weight": s["weight"]}
        for s in st.session_state["portfolio"]
        if s["fund_id"] and s["fund_id"] in fund_by_id and s["weight"] > 0
    ]
    if active_slots:
        st.divider()
        agg = aggregate_portfolio(active_slots)
        st.markdown("**主题暴露**")
        top = sorted(agg.items(), key=lambda x: -x[1])[:6]
        for j in range(0, len(top), 2):
            row = top[j:j+2]
            cols = st.columns(2)
            for col, (tag, sc) in zip(cols, row):
                col.metric(tag[:12], f"{sc:.1f}%")

        # 对比基准（折叠）
        with st.expander("与标准组合对比"):
            _render_comparison(agg, mobile=True)


# ── 电脑端 ────────────────────────────────────────────────────────
def _render_desktop(all_funds):
    fund_options = {f["name"]: f["fund_id"] for f in all_funds}
    fund_by_id   = {f["fund_id"]: f for f in all_funds}

    # 主题快选：6列
    st.markdown("**快速主题**")
    theme_cols = st.columns(6)
    for i, p in enumerate(PRESET_THEMES[:6]):
        with theme_cols[i]:
            if st.button(p["label"], key=f"dt_{p['label']}", use_container_width=True):
                _apply_theme(p, all_funds); st.rerun()

    st.divider()

    col_left, col_right = st.columns([1, 1], gap="large")

    with col_left:
        st.markdown("**组合持仓**")
        st.caption("最多5只，权重合计100%")
        total_weight = 0
        for i, slot in enumerate(st.session_state["portfolio"]):
            fid  = slot["fund_id"]
            name = fund_by_id[fid]["name"] if fid and fid in fund_by_id else ""
            c1, c2, c3 = st.columns([4, 1.2, 0.5])
            with c1:
                chosen = st.selectbox(
                    f"仓位{i+1}", [""] + list(fund_options.keys()),
                    index=(list(fund_options.keys()).index(name) + 1
                           if name in fund_options else 0),
                    key=f"df_{i}", label_visibility="collapsed",
                )
                st.session_state["portfolio"][i]["fund_id"] = fund_options.get(chosen)
            with c2:
                new_w = st.number_input("权重", 0, 100, int(slot["weight"]),
                                        step=5, key=f"dw_{i}",
                                        label_visibility="collapsed")
                st.session_state["portfolio"][i]["weight"] = new_w
                total_weight += new_w
            with c3:
                if slot["fund_id"] and slot["fund_id"] in fund_by_id:
                    risk  = fund_by_id[slot["fund_id"]]["risk"]
                    color = RISK_COLORS.get(risk, "#888")
                    st.markdown(
                        f"<div style='width:10px;height:10px;border-radius:50%;"
                        f"background:{color};margin-top:8px'></div>",
                        unsafe_allow_html=True,
                    )

        wcolor = "green" if total_weight==100 else ("red" if total_weight>100 else "orange")
        st.markdown(f"合计：<span style='color:{wcolor};font-weight:600'>{total_weight}%</span>",
                    unsafe_allow_html=True)
        if st.button("均分权重", key="d_eq"):
            _equal_weight(); st.rerun()

    with col_right:
        active_slots = [
            {"fund": fund_by_id[s["fund_id"]], "weight": s["weight"]}
            for s in st.session_state["portfolio"]
            if s["fund_id"] and s["fund_id"] in fund_by_id and s["weight"] > 0
        ]
        if not active_slots:
            st.info("请在左侧选择基金")
        else:
            agg = aggregate_portfolio(active_slots)
            st.markdown("**主题暴露（加权得分）**")
            for tag, sc in sorted(agg.items(), key=lambda x: -x[1])[:8]:
                bar_pct = min(int(sc / 50 * 100), 100)
                color   = TAG_COLORS.get(tag, "#888")
                st.markdown(
                    f"<div style='display:flex;align-items:center;gap:8px;margin:3px 0'>"
                    f"<span style='font-size:11px;color:gray;width:130px;text-align:right'>{tag}</span>"
                    f"<div style='flex:1;background:#eee;border-radius:2px;height:6px'>"
                    f"<div style='width:{bar_pct}%;height:6px;background:{color};border-radius:2px'></div></div>"
                    f"<span style='font-size:12px;font-weight:600;width:40px'>{sc:.1f}%</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )

    # 对比基准
    active_slots2 = [
        {"fund": fund_by_id[s["fund_id"]], "weight": s["weight"]}
        for s in st.session_state["portfolio"]
        if s["fund_id"] and s["fund_id"] in fund_by_id and s["weight"] > 0
    ]
    if active_slots2:
        st.divider()
        _render_comparison(aggregate_portfolio(active_slots2), mobile=False)


def _render_comparison(agg: dict, mobile: bool = False):
    import pandas as pd
    risk_level = st.selectbox("对比基准", list(BENCHMARKS.keys()),
                              key="bm_sel_m" if mobile else "bm_sel_d")
    bm = BENCHMARKS[risk_level]
    all_tags = sorted(set(list(agg.keys()) + list(bm.keys())),
                      key=lambda t: -max(agg.get(t, 0), bm.get(t, 0)))[:10]
    rows = []
    for tag in all_tags:
        pv, bv = agg.get(tag, 0), bm.get(tag, 0)
        if pv < 1 and bv < 1:
            continue
        diff = pv - bv
        rows.append({"主题": tag, "组合": round(pv, 1), "基准": round(bv, 1),
                     "偏差": round(diff, 1),
                     "判断": "超配↑" if diff > 5 else ("低配↓" if diff < -5 else "匹配✓")})
    if rows:
        df = pd.DataFrame(rows)
        def color_diff(val):
            if isinstance(val, float):
                if val > 5:  return "color:#A32D2D;font-weight:600"
                if val < -5: return "color:#BA7517;font-weight:600"
            return ""
        st.dataframe(df.style.applymap(color_diff, subset=["偏差"]),
                     use_container_width=True, hide_index=True)


def render(is_mobile: bool = False):
    st.title("📐 组合构建器")
    _init_portfolio()
    all_funds = load_fund_list()
    if is_mobile:
        _render_mobile(all_funds)
    else:
        _render_desktop(all_funds)
