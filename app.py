# -*- coding: utf-8 -*-
"""
宏观资产配置优化器 - V10：三组合重构 + Fee-Aware 选基逻辑
Tab1 精选 Portfolio（Fee-First）| Tab2 Model Portfolio（Optimizer-First）| Tab3 补充 Portfolio（Diversify-First）
MRF_POOL 含 fee_rate 字段（占位 0.0，接 DB 时从 fund_fees 表读入覆盖）。
"""
import streamlit as st
import pandas as pd
import requests
import ipaddress
from datetime import datetime
from zoneinfo import ZoneInfo
import numpy as np
from scipy.optimize import minimize

# 渣打 WMP 数据模块（导入失败时仍显示 Tab，便于排查）
WMP_AVAILABLE = False
WMP_ERROR = None
try:
    from db_manager import get_wmp_display_data, init_db, insert_nav_records
    from wmp_scraper import scrape_wmp
    WMP_AVAILABLE = True
except Exception as e:
    WMP_ERROR = f"{type(e).__name__}: {e}"

# --- Supabase 访客雷达（可选，依赖 st.secrets）---
def get_supabase_client():
    try:
        from supabase import create_client
        url = st.secrets.get("SUPABASE_URL") or st.secrets.get("supabase", {}).get("SUPABASE_URL")
        key = st.secrets.get("SUPABASE_KEY") or st.secrets.get("supabase", {}).get("SUPABASE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def get_real_ip():
    try:
        headers = st.context.headers
        ips = []
        if "X-Forwarded-For" in headers:
            ips.extend([ip.strip() for ip in headers["X-Forwarded-For"].split(",")])
        if "X-Real-Ip" in headers:
            ips.append(headers["X-Real-Ip"].strip())
        for ip in ips:
            try:
                parsed = ipaddress.ip_address(ip)
                if not parsed.is_private and not parsed.is_loopback:
                    return ip
            except ValueError:
                continue
    except Exception:
        pass
    return "隐身访客"


def get_geo_location(ip):
    if ip == "隐身访客" or not ip:
        return ip
    try:
        res = requests.get(f"http://ip-api.com/json/{ip}?lang=zh-CN", timeout=2).json()
        if res.get("status") == "success":
            return f"{res['city']}, {res['country']} ({ip})"
    except Exception:
        pass
    return ip


def track_visitor():
    if st.session_state.get("has_logged"):
        return
    st.session_state.has_logged = True
    raw_ip = get_real_ip()
    geo_ip = get_geo_location(raw_ip)
    now_str = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S")
    try:
        from supabase import create_client
        url = st.secrets.get("SUPABASE_URL") or st.secrets.get("supabase", {}).get("SUPABASE_URL")
        key = st.secrets.get("SUPABASE_KEY") or st.secrets.get("supabase", {}).get("SUPABASE_KEY")
        if not url or not key:
            return
        client = create_client(url, key)
        res = client.table("visitor_logs").select("visits").eq("ip", geo_ip).execute()
        if res.data and len(res.data) > 0:
            new_visits = res.data[0]["visits"] + 1
            client.table("visitor_logs").update({"visits": new_visits, "last_visit": now_str}).eq("ip", geo_ip).execute()
        else:
            client.table("visitor_logs").insert({"ip": geo_ip, "visits": 1, "last_visit": now_str}).execute()
    except Exception:
        pass


st.set_page_config(page_title="机构级宏观资产配置引擎", layout="wide", initial_sidebar_state="collapsed")

# --- 0. 状态管理 ---
if "device" not in st.session_state:
    st.session_state.device = None
if "entry" not in st.session_state:
    st.session_state.entry = None


def set_device(device_type, entry_type="config"):
    st.session_state.device = device_type
    st.session_state.entry = entry_type
    st.rerun()


def back_to_landing():
    st.session_state.device = None
    st.session_state.entry = None
    st.rerun()


# --- 1. 核心数据 ---
SCB_TARGET = {
    "平稳 (Income)":     {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)":   {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3},
}

# 标准组合的二级细分（对应图片 Fig.3 Foundation Balanced 细项）
SCB_DETAIL = {
    "平稳 (Income)": {
        "股票": {
            "North America": 14, "Europe ex-UK": 3, "UK": 1, "Japan": 1, "Asia ex-Japan": 4
        },
        "固定收益": {
            "DM IG Government": 25, "DM IG Corporate": 10, "DM HY Corporate": 1,
            "EM USD Government": 8, "EM Local Ccy Government": 6, "Asia USD": 8
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 3},
    },
    "均衡 (Balanced)": {
        "股票": {
            "North America": 38, "Europe ex-UK": 6, "UK": 1, "Japan": 2, "Asia ex-Japan": 7
        },
        "固定收益": {
            "DM IG Government": 16, "DM IG Corporate": 5, "DM HY Corporate": 1,
            "EM USD Government": 6, "EM Local Ccy Government": 5, "Asia USD": 5
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 2},
    },
    "进取 (Aggressive)": {
        "股票": {
            "North America": 51, "Europe ex-UK": 8, "UK": 2, "Japan": 3, "Asia ex-Japan": 10
        },
        "固定收益": {
            "DM IG Government": 8, "DM IG Corporate": 1,
            "EM USD Government": 4, "EM Local Ccy Government": 2, "Asia USD": 3
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 2},
    },
}

# fee_rate 来自爬虫 updated_funds_fees.xlsx（小数 0.02 表示 2%，已转为百分点 2.0）
MRF_POOL = {
    "东方汇理香港组合-灵活配置增长": {"brand": "Amundi", "股票": 70, "固定收益": 25, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置均衡": {"brand": "Amundi", "股票": 50, "固定收益": 45, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置平稳": {"brand": "Amundi", "股票": 30, "固定收益": 60, "现金": 10, "fee_rate": 3.0},
    "东亚联丰环球股票基金":           {"brand": "BEA",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "东亚联丰亚洲债券及货币基金":     {"brand": "BEA",   "股票": 0,  "固定收益": 95, "现金": 5, "fee_rate": 2.0},
    "惠理高息股票基金":               {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5, "fee_rate": 2.5},
    "惠理价值基金":                   {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5, "fee_rate": 2.5},
    "摩根国际债":                     {"brand": "JPM",   "股票": 0,  "固定收益": 95, "现金": 5, "fee_rate": 2.0},
    "摩根太平洋科技":                 {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "摩根太平洋证券":                 {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "摩根亚洲股息":                   {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "摩根亚洲总收益":                 {"brand": "JPM",   "股票": 50, "固定收益": 45, "现金": 5, "fee_rate": 1.0},
    "瑞士百达策略收益基金":           {"brand": "Pictet","股票": 40, "固定收益": 50, "现金": 10, "fee_rate": 3.0},
    "中银香港环球股票基金":           {"brand": "BOC",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "中银香港香港股票基金":           {"brand": "BOC",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "施罗德亚洲高息股债基金M类别(人民币派息)": {"brand": "Schroders", "股票": 64, "固定收益": 23, "现金": 13, "fee_rate": 2.0},
}
# 未来接 DB：fund_fees 表 (fund_name TEXT PRIMARY KEY, fee_rate REAL, updated_at TEXT)

# 渣打铁律：垃圾债占比不超限。东亚联丰亚洲债券为纯垃圾债，算法中排除，用其他固收产品替代。
EXCLUDED_FUNDS = {"东亚联丰亚洲债券及货币基金"}
# Tab1 最高费率方案：候选为申购费 >= 该值的基金（多基金公司 2.5%～3% 一起优化）；Tab3 补充方案申购费放宽至 1.5%～3%
FEE_FIRST_MIN_FEE = 2.5
DIVERSIFY_FEE_MIN, DIVERSIFY_FEE_MAX = 1.5, 3.0
# Tab3 建议 3～4 只；Tab2 不限制数量
MAX_FUNDS_DIVERSIFY = 4
# 权重低于此比例的基金不展示（操作意义不大），剔除后重新归一化（Tab2 不用此过滤，以最优配置为目标）
MIN_WEIGHT_DISPLAY = 0.10
# 费率优先 Tab1 不推荐摩根国际债；债券端用东方汇理灵活配置平稳
FEE_FIRST_EXCLUDE_BOND_FUNDS = {"摩根国际债"}
PREFERRED_BOND_PROXY = "东方汇理香港组合-灵活配置平稳"

def _pool_without_excluded():
    """可用于优化的基金池（排除纯垃圾债等）。"""
    return [f for f in MRF_POOL if f not in EXCLUDED_FUNDS]

# 基金补充明细（债券信用/股票地区与行业/Top 持股），按基金名称索引，供展示或穿透用
MRF_FUND_DETAIL = {
    "施罗德亚洲高息股债基金M类别(人民币派息)": {
        "bond_credit": {"投资级别债券": 70.54, "垃圾债": 29.46},
        "bond_region": "亚洲债券",
        "equity_region": {
            "中国大陆": 14.35, "中国香港": 4.46, "中国台湾": 8.98, "印度": 5.51,
            "澳大利亚": 3.99, "韩国": 3.78, "新加坡": 5.13, "日本": 1.94, "其他": 16.02,
        },
        "equity_sector": {
            "金融": 14.46, "科技": 10.87, "非必须消费品": 4.73, "公共事业": 3.78,
            "通讯": 4.08, "房地产信托": 3.68, "工业制造": 2.64, "其他": 19.69,
        },
        "top_holdings": [
            ("台积电", 2.29), ("CHINA CONSTRUCTION BANK CORP H", 1.78),
            ("HON HAI PRECISION INDUSTRY LTD", 1.69), ("DBS GROUP HOLDINGS LTD", 1.59),
            ("联发科技", 1.34),
        ],
    },
}
# 启动时 conn.execute("SELECT fund_name, fee_rate FROM fund_fees"); for name, fee in rows: MRF_POOL[name]["fee_rate"] = fee or 0.0

# 资产颜色映射
ASSET_COLORS = {
    "股票":    "#1d6fa4",
    "固定收益": "#2c8c6b",
    "黄金":    "#d4a017",
    "现金":    "#8c8c8c",
}


def _compute_achieved(funds: list, weights: list) -> dict:
    """根据 funds + weights 计算穿透后股/债/金/现占比（黄金 MRF 无暴露故恒为 0）。"""
    achieved = {"股票": 0.0, "固定收益": 0.0, "黄金": 0.0, "现金": 0.0}
    for i, f in enumerate(funds):
        achieved["股票"] += MRF_POOL[f]["股票"] * weights[i]
        achieved["固定收益"] += MRF_POOL[f]["固定收益"] * weights[i]
        achieved["现金"] += MRF_POOL[f]["现金"] * weights[i]
    return achieved


def _drop_small_weights(funds: list, weights: list, min_weight: float = MIN_WEIGHT_DISPLAY):
    """剔除权重低于 min_weight 的基金，重新归一化；低于 10% 操作意义不大不展示。"""
    keep = [i for i in range(len(weights)) if weights[i] >= min_weight]
    if not keep or len(keep) == len(weights):
        return funds, weights
    new_f = [funds[i] for i in keep]
    s = sum(weights[i] for i in keep)
    if s <= 0:
        return funds, weights
    new_w = [weights[i] / s for i in keep]
    return new_f, new_w


def _minimize_weights_3d(fund_names: list, target_alloc: dict):
    """
    3 维（股/债/现）加权最小二乘：min ||Aw - b||^2, sum(w)=1, w>=0。
    target 使用比例（0~1），黄金无 MRF 暴露不参与。
    """
    if not fund_names:
        return [], []
    n = len(fund_names)
    # b: 目标比例（股/债/现，归一化到三者之和=1 以与 A 一致，因 A 每行和为 100）
    s = target_alloc["股票"] + target_alloc["固定收益"] + target_alloc["现金"]
    b = np.array([
        target_alloc["股票"] / s,
        target_alloc["固定收益"] / s,
        target_alloc["现金"] / s,
    ], dtype=float)
    # A: 3 x n，每列一只基金的股/债/现占比（比例 0~1）
    A = np.array([
        [MRF_POOL[f]["股票"] / 100.0 for f in fund_names],
        [MRF_POOL[f]["固定收益"] / 100.0 for f in fund_names],
        [MRF_POOL[f]["现金"] / 100.0 for f in fund_names],
    ], dtype=float)

    def obj(w):
        return np.sum((A @ w - b) ** 2)

    w0 = np.ones(n) / n
    bounds = [(0.0, 1.0)] * n
    cons = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
    res = minimize(obj, w0, method="SLSQP", bounds=bounds, constraints=cons)
    if not res.success:
        return fund_names, list(w0)
    w = res.x
    # 剔除权重 < 3% 的碎股，重新归一化
    w = np.maximum(w, 0.0)
    w[w < 0.03] = 0.0
    if w.sum() <= 0:
        return fund_names, list(np.ones(n) / n)
    w = w / w.sum()
    # 只保留权重大于 0 的基金
    keep = w > 1e-6
    return [fund_names[i] for i in range(n) if keep[i]], [float(w[i]) for i in range(n) if keep[i]]


def combo_fee_first(target_alloc: dict):
    """
    Tab1 最高费率配置：候选为申购费 >= FEE_FIRST_MIN_FEE 的基金（多基金公司 2.5%～3% 一起做优化），
    排除摩根国际债，债券端用东方汇理平稳；优化后剔除 <10% 权重的碎单。
    """
    pool = _pool_without_excluded()
    min_fee = FEE_FIRST_MIN_FEE
    high_fee = [f for f in pool if (MRF_POOL[f].get("fee_rate") or 0) >= min_fee and f not in FEE_FIRST_EXCLUDE_BOND_FUNDS]
    has_bond = any(MRF_POOL[f]["固定收益"] > 60 for f in high_fee)
    if not has_bond and PREFERRED_BOND_PROXY in pool and PREFERRED_BOND_PROXY not in high_fee:
        high_fee.append(PREFERRED_BOND_PROXY)
    selected = high_fee if len(high_fee) >= 2 else pool
    if len(selected) < 2:
        selected = pool
    funds, weights = _minimize_weights_3d(selected, target_alloc)
    funds, weights = _drop_small_weights(funds, weights)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


def combo_optimizer(target_alloc: dict):
    """
    Tab2 最优配置组合：不限制基金数量，全池 3D 二次规划，以达到最优配置比例为目标。
    仅剔除 <3% 碎股（在 _minimize_weights_3d 内），不做 10% 下限过滤。
    """
    all_funds = _pool_without_excluded()
    funds, weights = _minimize_weights_3d(all_funds, target_alloc)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


def combo_diversify(target_alloc: dict, used_funds_set: set):
    """
    Tab3 补充方案：排除 Tab1+Tab2 已用基金与纯垃圾债，申购费放宽至 1.5%～3% 做优化，
    最多保留 3～4 只，按权重取前 N 只后剔除 <10% 碎单。
    """
    pool = _pool_without_excluded()
    fee_min, fee_max = DIVERSIFY_FEE_MIN, DIVERSIFY_FEE_MAX
    available = [f for f in pool if f not in used_funds_set and fee_min <= (MRF_POOL[f].get("fee_rate") or 0) <= fee_max]
    if not available:
        available = [f for f in pool if f not in used_funds_set]
    if not available:
        available = pool
    add_from = [f for f in used_funds_set if f in MRF_POOL and f not in EXCLUDED_FUNDS]
    has_equity = any(MRF_POOL[f]["股票"] > 0 for f in available)
    has_bond = any(MRF_POOL[f]["固定收益"] > 0 for f in available)
    if add_from:
        if not has_equity:
            equity_used = [f for f in add_from if MRF_POOL[f]["股票"] > 0]
            if equity_used:
                best = max(equity_used, key=lambda x: MRF_POOL[x].get("fee_rate") or 0)
                available.append(best)
        if not has_bond:
            bond_used = [f for f in add_from if MRF_POOL[f]["固定收益"] > 0]
            if bond_used:
                best = max(bond_used, key=lambda x: MRF_POOL[x].get("fee_rate") or 0)
                if best not in available:
                    available.append(best)
    funds, weights = _minimize_weights_3d(available, target_alloc)
    if len(funds) > MAX_FUNDS_DIVERSIFY:
        paired = sorted(zip(weights, funds), key=lambda x: x[0], reverse=True)[:MAX_FUNDS_DIVERSIFY]
        funds = [f for _, f in paired]
        w_sum = sum(w for w, _ in paired)
        weights = [w / w_sum for w, _ in paired]
    funds, weights = _drop_small_weights(funds, weights)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


# ─────────────────────────────────────────────
#  渲染辅助：标准组合构成表
# ─────────────────────────────────────────────
def render_standard_portfolio_table(risk_level: str, target_alloc: dict):
    """
    渲染标准组合构成表：
    - 顶层四类汇总（股票/固定收益/黄金/现金）
    - 二级细分明细（来自 SCB_DETAIL）
    """
    st.markdown("### 📊 标准组合构成")
    st.caption(f"渣打 SCB Foundation — **{risk_level}**")

    detail = SCB_DETAIL.get(risk_level, {})

    rows = []
    for asset_class, target_pct in target_alloc.items():
        sub = detail.get(asset_class, {})
        # 顶层合计行
        rows.append({
            "资产类别": f"**{asset_class}**",
            "细分": "—",
            "目标占比": f"**{target_pct}%**",
        })
        # 细分行
        for sub_name, sub_pct in sub.items():
            rows.append({
                "资产类别": "",
                "细分": f"↳ {sub_name}",
                "目标占比": f"{sub_pct}%",
            })

    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "资产类别": st.column_config.TextColumn("资产类别", width="small"),
            "细分":     st.column_config.TextColumn("细分项目", width="medium"),
            "目标占比": st.column_config.TextColumn("目标占比", width="small"),
        }
    )


# ─────────────────────────────────────────────
#  渲染辅助：穿透对比 metric 行
# ─────────────────────────────────────────────
def render_penetration_metrics(achieved: dict, target_alloc: dict, device: str = "desktop"):
    """显示穿透后各资产类别 vs 基准对比（4 个 metric）"""
    if device == "mobile":
        c1, c2 = st.columns(2)
        c1.metric("📉 股票敞口",  f"{achieved['股票']:.1f}%",    f"基准: {target_alloc['股票']}%",    delta_color="off")
        c2.metric("🛡️ 固收敞口", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
        c3, c4 = st.columns(2)
        gold_delta = achieved["黄金"] - target_alloc["黄金"]
        c3.metric("🥇 黄金敞口", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
        c4.metric("💵 现金敞口", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")
    else:
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("📉 穿透后: 股票",  f"{achieved['股票']:.1f}%",    f"基准: {target_alloc['股票']}%",    delta_color="off")
        col2.metric("🛡️ 穿透后: 固收", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
        gold_delta = achieved["黄金"] - target_alloc["黄金"]
        col3.metric("🥇 穿透后: 黄金", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
        col4.metric("💵 穿透后: 现金", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")


# ─────────────────────────────────────────────
#  渲染辅助：落地基金产品 + 底层穿透明细
# ─────────────────────────────────────────────
def render_fund_penetration_table(
    funds: list,
    weights: list,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
):
    """
    渲染落地基金产品表格，含申购费列；
    可选 weighted_avg_fee 在表下方显示组合加权平均申购费；
    可选 is_new_fund（与 funds 同长）用于 Tab3 显示「是否新增品种」✅/➕
    """
    st.markdown("### 💼 建议落地基金 & 底层穿透")
    st.caption("以下产品组合旨在贴近上方标准组合。底层持仓来自各基金招募说明书。")

    base = {
        "落地基金产品": funds,
        "品牌": [MRF_POOL[f]["brand"] for f in funds],
        "配置权重(%)": [round(w * 100, 1) for w in weights],
        "申购费(%)": [round(MRF_POOL[f].get("fee_rate") or 0.0, 2) for f in funds],
        "底层: 股票%": [MRF_POOL[f]["股票"] for f in funds],
        "底层: 固收%": [MRF_POOL[f]["固定收益"] for f in funds],
        "底层: 现金%": [MRF_POOL[f]["现金"] for f in funds],
        "买入金额(¥)": [round(capital * w) for w in weights],
    }
    if is_new_fund is not None and len(is_new_fund) == len(funds):
        base["是否新增品种"] = ["✅" if x else "➕" for x in is_new_fund]
    df = pd.DataFrame(base)
    col_cfg = {
        "配置权重(%)": st.column_config.ProgressColumn("配置权重(%)", min_value=0, max_value=100, format="%.1f%%"),
        "申购费(%)": st.column_config.NumberColumn("申购费(%)", format="%.2f%%"),
        "底层: 股票%": st.column_config.ProgressColumn("底层 股票%", min_value=0, max_value=100, format="%d%%"),
        "底层: 固收%": st.column_config.ProgressColumn("底层 固收%", min_value=0, max_value=100, format="%d%%"),
        "底层: 现金%": st.column_config.ProgressColumn("底层 现金%", min_value=0, max_value=100, format="%d%%"),
        "买入金额(¥)": st.column_config.NumberColumn("买入金额", format="¥%d"),
    }
    st.dataframe(df, use_container_width=True, hide_index=True, column_config=col_cfg)
    if weighted_avg_fee is not None:
        st.caption(f"**组合加权平均申购费** = Σ(权重 × 申购费) = **{weighted_avg_fee:.2f}%**")


# ─────────────────────────────────────────────
#  渲染辅助：加权穿透汇总 vs 标准对比表
# ─────────────────────────────────────────────
def render_penetration_summary(achieved: dict, target_alloc: dict):
    """渲染穿透后汇总 vs 标准组合的对比表，含偏差列"""
    st.markdown("### 🎯 穿透汇总 vs 标准基准")

    rows = []
    for asset, target_pct in target_alloc.items():
        ach = achieved.get(asset, 0.0)
        diff = ach - target_pct
        diff_str = f"+{diff:.1f}%" if diff > 0 else (f"{diff:.1f}%" if diff != 0 else "持平")
        status = "✅" if abs(diff) <= 5 else ("⚠️ 缺项" if diff < -5 else "⚠️ 超配")
        rows.append({
            "资产类别": asset,
            "标准目标%": target_pct,
            "穿透后%": round(ach, 1),
            "偏差":  diff_str,
            "状态":  status,
        })
    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "标准目标%": st.column_config.NumberColumn("标准目标", format="%d%%"),
            "穿透后%":   st.column_config.NumberColumn("穿透后实际", format="%.1f%%"),
        }
    )


# ─────────────────────────────────────────────
#  主渲染函数：电脑端（并排布局）
# ─────────────────────────────────────────────
def render_desktop_ui(
    funds: list,
    weights: list,
    achieved: dict,
    risk_level: str,
    target_alloc: dict,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
):
    # ── 区块一：标准组合构成 ──────────────────────────────
    with st.container():
        left_col, right_col = st.columns([1, 1], gap="large")

        with left_col:
            render_standard_portfolio_table(risk_level, target_alloc)

        with right_col:
            st.markdown("### 🔍 穿透汇总 vs 标准基准")
            st.caption("各基金底层持仓加权后 vs SCB 目标")
            render_penetration_metrics(achieved, target_alloc, device="desktop")
            st.write("")
            render_penetration_summary(achieved, target_alloc)

    st.divider()

    # ── 区块二：建议落地基金 + 底层穿透明细 ──────────────
    render_fund_penetration_table(
        funds, weights, capital,
        weighted_avg_fee=weighted_avg_fee,
        is_new_fund=is_new_fund,
    )

    # ── 区块三：每只基金详细穿透卡片 ─────────────────────
    st.markdown("### 🃏 各基金底层持仓明细")
    st.caption("展示每只建议基金的底层资产构成，帮助理解如何逼近标准组合")

    cols = st.columns(len(funds))
    for i, (f, w) in enumerate(zip(funds, weights)):
        fund_data = MRF_POOL[f]
        fee = fund_data.get("fee_rate") or 0.0
        with cols[i]:
            with st.container(border=True):
                st.markdown(f"**{f}**")
                st.caption(f"品牌: {fund_data['brand']} | 申购费: {fee:.2f}%")
                st.markdown(f"配置权重: **{w*100:.1f}%** | 买入: **¥{capital*w:,.0f}**")
                st.write("")
                # 底层持仓可视化
                for asset, color in [("股票", "#1d6fa4"), ("固定收益", "#2c8c6b"), ("现金", "#8c8c8c")]:
                    pct = fund_data[asset]
                    contribution = pct * w
                    st.markdown(
                        f"<div style='margin-bottom:4px;'>"
                        f"  <span style='font-size:12px;color:#555;'>{asset}</span>"
                        f"  <span style='float:right;font-size:12px;font-weight:600;'>{pct}%</span>"
                        f"</div>"
                        f"<div style='background:#eee;border-radius:4px;height:8px;margin-bottom:8px;'>"
                        f"  <div style='background:{color};width:{pct}%;height:8px;border-radius:4px;'></div>"
                        f"</div>"
                        f"<div style='font-size:11px;color:#888;margin-bottom:10px;'>"
                        f"  贡献至组合: {contribution:.1f}%"
                        f"</div>",
                        unsafe_allow_html=True
                    )


# ─────────────────────────────────────────────
#  主渲染函数：手机端（竖向布局）
# ─────────────────────────────────────────────
def render_mobile_ui(
    funds: list,
    weights: list,
    achieved: dict,
    risk_level: str,
    target_alloc: dict,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
):
    # 标准组合构成（折叠）
    with st.expander("📊 标准组合构成（点击展开）", expanded=False):
        render_standard_portfolio_table(risk_level, target_alloc)

    st.write("---")

    # 穿透指标
    st.markdown("#### 穿透结果 vs 基准")
    render_penetration_metrics(achieved, target_alloc, device="mobile")

    st.write("---")

    # 落地基金卡片
    st.markdown("#### 💼 具体买入清单")
    for i, f in enumerate(funds):
        fee = MRF_POOL[f].get("fee_rate") or 0.0
        tag = " ✅ 新增" if (is_new_fund and i < len(is_new_fund) and is_new_fund[i]) else " ➕ 复用"
        with st.container(border=True):
            st.markdown(f"**{f}**{tag if is_new_fund else ''}")
            st.markdown(f"**配置权重**: `{weights[i] * 100:.1f}%` ｜ **金额**: `¥{capital * weights[i]:,.0f}` ｜ 申购费 {fee:.2f}%")
            st.caption(f"底层物理持仓: 股{MRF_POOL[f]['股票']}% / 债{MRF_POOL[f]['固定收益']}% / 现{MRF_POOL[f]['现金']}%")
    if weighted_avg_fee is not None:
        st.caption(f"组合加权平均申购费 = **{weighted_avg_fee:.2f}%**")

    st.write("---")
    render_penetration_summary(achieved, target_alloc)


# ─────────────────────────────────────────────
#  引导页
# ─────────────────────────────────────────────
if st.session_state.device is None:
    st.title("🎯 宏观资产配置引擎")
    st.write("请选择入口与设备：")
    st.subheader("宏观资产配置引擎")
    r1c1, r1c2 = st.columns(2)
    with r1c1:
        st.button("📱 手机", key="cfg_mobile", on_click=set_device, args=("mobile", "config"), use_container_width=True)
    with r1c2:
        st.button("💻 电脑", key="cfg_desktop", on_click=set_device, args=("desktop", "config"), use_container_width=True)
    st.write("")
    st.subheader("WMP NAV")
    r2c1, r2c2 = st.columns(2)
    with r2c1:
        st.button("📱 手机", key="wmp_mobile", on_click=set_device, args=("mobile", "wmp"), use_container_width=True)
    with r2c2:
        st.button("💻 电脑", key="wmp_desktop", on_click=set_device, args=("desktop", "wmp"), use_container_width=True)
    st.stop()

# 访客追踪
track_visitor()

# 全局合规提示
st.error("⚠️ **合规风险提示**：本模拟器仅作算法演示，不可作为实际交易决策！")

# ─────────────────────────────────────────────
#  WMP 入口
# ─────────────────────────────────────────────
if st.session_state.entry == "wmp":
    if st.session_state.device == "desktop":
        with st.sidebar:
            st.button("⬅️ 返回首页", on_click=back_to_landing)
    else:
        st.button("⬅️ 返回首页", on_click=back_to_landing)
    st.subheader("🏦 渣打 WMP 净值")
    if not WMP_AVAILABLE:
        st.error("**WMP 模块未加载**。请安装依赖后重启：`pip install requests beautifulsoup4`")
        if WMP_ERROR:
            st.code(WMP_ERROR, language="text")
    else:
        if st.button("🔄 抓取今日净值并写入 CSV"):
            with st.spinner("正在抓取渣打 WMP 页面…"):
                records = scrape_wmp()
            if records:
                init_db()
                n = insert_nav_records(records)
                st.success(f"已写入 {n} 条新记录（共抓取 {len(records)} 条）。")
            else:
                st.warning("未抓取到数据，请检查网络或稍后重试。")
        df_wmp = get_wmp_display_data()
        if df_wmp.empty:
            st.info("暂无净值历史数据。请先点击「抓取今日净值并写入 CSV」。")
        else:
            yield_cols = ["daily% 【年化】", "1W收益率% 【年化】", "1M收益率% 【年化】", "3M收益率% 【年化】"]
            def _color_yield(val):
                if val == "N/A" or not isinstance(val, str):
                    return ""
                try:
                    num = float(str(val).replace("%", "").strip())
                    if num > 0:
                        return "color: red"
                    if num < 0:
                        return "color: green"
                except ValueError:
                    pass
                return ""
            styled = df_wmp.style.apply(lambda s: [_color_yield(v) for v in s], subset=yield_cols)
            st.dataframe(styled, use_container_width=True, hide_index=True)
        st.caption("**赎回到账**：WMP 产品 T+1 到账；142890 T+2 到账；汇华 CIO 系列 T+5 到账。")
    st.stop()

# ─────────────────────────────────────────────
#  宏观资产配置主界面
# ─────────────────────────────────────────────
if st.session_state.device == "mobile":
    st.subheader("⚙️ 资产配置参数")
    risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
    capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)
else:
    with st.sidebar:
        st.button("⬅️ 返回首页", on_click=back_to_landing)
        st.header("⚙️ 引擎控制台")
        risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
        capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)

target_alloc = SCB_TARGET[risk_level]

# 当前基准一行摘要
st.write(
    f"当前基准：**渣打 - {risk_level}** "
    f"(股{target_alloc['股票']}% / 债{target_alloc['固定收益']}% / 金{target_alloc['黄金']}% / 现{target_alloc['现金']}%)"
)
st.divider()

# ─────────────────────────────────────────────
#  三组合：先统一算好再渲染，保证 Tab3 的 used_funds 与 Tab1/Tab2 一致
# ─────────────────────────────────────────────
res_fee = combo_fee_first(target_alloc)
res_opt = combo_optimizer(target_alloc)
used_funds_set = set(res_fee[0]) | set(res_opt[0])
res_div = combo_diversify(target_alloc, used_funds_set)

def _weighted_avg_fee(funds: list, weights: list) -> float:
    """组合加权平均申购费（%），fee_rate 存为百分点如 1.5 表示 1.5%。"""
    return sum((MRF_POOL[f].get("fee_rate") or 0.0) * w for f, w in zip(funds, weights))

is_mobile = st.session_state.device == "mobile"
tab_labels = (
    ["💰 精选 Portfolio（手续费优先）", "🎯 Model Portfolio（最优匹配）", "🔄 补充 Portfolio（差异化配置）"]
    if is_mobile else
    ["💰 Tab1: 精选 Portfolio（手续费优先）", "🎯 Tab2: Model Portfolio（最优匹配）", "🔄 Tab3: 补充 Portfolio（差异化配置）"]
)
t1, t2, t3 = st.tabs(tab_labels)

with t1:
    f1, w1, a1 = res_fee
    waf1 = _weighted_avg_fee(f1, w1)
    if is_mobile:
        render_mobile_ui(f1, w1, a1, risk_level, target_alloc, capital, weighted_avg_fee=waf1, is_new_fund=None)
    else:
        render_desktop_ui(f1, w1, a1, risk_level, target_alloc, capital, weighted_avg_fee=waf1, is_new_fund=None)

with t2:
    f2, w2, a2 = res_opt
    if is_mobile:
        render_mobile_ui(f2, w2, a2, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=None)
    else:
        render_desktop_ui(f2, w2, a2, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=None)

with t3:
    f3, w3, a3 = res_div
    is_new = [f not in used_funds_set for f in f3]
    if is_mobile:
        render_mobile_ui(f3, w3, a3, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=is_new)
    else:
        render_desktop_ui(f3, w3, a3, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=is_new)

# ─────────────────────────────────────────────
#  引擎状态监控（折叠）
# ─────────────────────────────────────────────
st.divider()
with st.expander("♏ 引擎状态监控", expanded=False):
    try:
        import supabase
        if "SUPABASE_URL" in st.secrets and "SUPABASE_KEY" in st.secrets:
            client = supabase.create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"])
            res = client.table("visitor_logs").select("*").order("last_visit", desc=True).execute()
            logs = res.data
            st.caption(f"👁️ 累计独立访客: {len(logs)}")
            if logs:
                df_logs = pd.DataFrame(logs)
                if set(["ip", "visits", "last_visit"]).issubset(df_logs.columns):
                    df_logs = df_logs[["ip", "visits", "last_visit"]]
                    df_logs.columns = ["访客 IP/定位", "频次", "最后出没"]
                st.dataframe(df_logs, hide_index=True, use_container_width=True)
    except Exception:
        pass
