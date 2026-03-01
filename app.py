# -*- coding: utf-8 -*-
"""
宏观资产配置优化器 - V8：双端自适应 + 移动端卡片流版
设备选择引导页 + 手机版(2x2 指标 + 卡片流) / 电脑版(侧边栏 + 宽表)
+ 渣打 WMP 净值展示 + Supabase 云端访客雷达
"""
import streamlit as st
import pandas as pd
import requests
import ipaddress
from datetime import datetime

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
    """使用 st.secrets 读取 SUPABASE_URL / SUPABASE_KEY，未配置时返回 None。"""
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
    """智能穿透：过滤 192/10/172 等局域网 IP，取第一个真实公网 IP"""
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
    """通过免费接口把 IP 翻译成具体城市"""
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
    """终极雷达：写入 Supabase，带 IP 归属地解析，同一会话只写一次，失败静默不崩溃。"""
    if st.session_state.get("has_logged"):
        return
    st.session_state.has_logged = True
    raw_ip = get_real_ip()
    geo_ip = get_geo_location(raw_ip)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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


def fetch_visitor_logs_df():
    """从 Supabase visitor_logs 拉取全部记录，按 last_visit 降序，返回 (DataFrame, 总IP数)。"""
    try:
        client = get_supabase_client()
        if not client:
            return pd.DataFrame(columns=["访客 IP", "访问频次", "最后出没"]), 0
        r = client.table("visitor_logs").select("ip, visits, last_visit").order("last_visit", desc=True).execute()
        if not r.data:
            return pd.DataFrame(columns=["访客 IP", "访问频次", "最后出没"]), 0
        df = pd.DataFrame(r.data)
        df = df.rename(columns={"ip": "访客 IP", "visits": "访问频次", "last_visit": "最后出没"})
        return df, len(df)
    except Exception:
        return pd.DataFrame(columns=["访客 IP", "访问频次", "最后出没"]), 0


st.set_page_config(page_title="机构级宏观资产配置引擎", layout="centered", initial_sidebar_state="collapsed")

# --- 0. 状态管理：设备路由 + 入口（宏观配置 / WMP）---
if "device" not in st.session_state:
    st.session_state.device = None
if "entry" not in st.session_state:
    st.session_state.entry = None  # "config" | "wmp"


def set_device(device_type, entry_type="config"):
    st.session_state.device = device_type
    st.session_state.entry = entry_type
    st.rerun()


def back_to_landing():
    st.session_state.device = None
    st.session_state.entry = None
    st.rerun()


# --- 1. 核心数据与引擎 ---
SCB_TARGET = {
    "平稳 (Income)": {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)": {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3}
}

MRF_POOL = {
    "东方汇理香港组合-灵活配置增长": {"brand": "Amundi", "股票": 70, "固定收益": 25, "现金": 5},
    "东方汇理香港组合-灵活配置均衡": {"brand": "Amundi", "股票": 50, "固定收益": 45, "现金": 5},
    "东方汇理香港组合-灵活配置平稳": {"brand": "Amundi", "股票": 30, "固定收益": 60, "现金": 10},
    "东亚联丰环球股票基金": {"brand": "BEA", "股票": 95, "固定收益": 0, "现金": 5},
    "东亚联丰亚洲债券及货币基金": {"brand": "BEA", "股票": 0, "固定收益": 95, "现金": 5},
    "惠理高息股票基金": {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5},
    "惠理价值基金": {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5},
    "摩根国际债": {"brand": "JPM", "股票": 0, "固定收益": 95, "现金": 5},
    "摩根太平洋科技": {"brand": "JPM", "股票": 95, "固定收益": 0, "现金": 5},
    "摩根太平洋证券": {"brand": "JPM", "股票": 95, "固定收益": 0, "现金": 5},
    "摩根亚洲股息": {"brand": "JPM", "股票": 95, "固定收益": 0, "现金": 5},
    "摩根亚洲总收益": {"brand": "JPM", "股票": 50, "固定收益": 45, "现金": 5},
    "瑞士百达策略收益基金": {"brand": "Pictet", "股票": 40, "固定收益": 50, "现金": 10},
    "中银香港环球股票基金": {"brand": "BOC", "股票": 95, "固定收益": 0, "现金": 5},
    "中银香港香港股票基金": {"brand": "BOC", "股票": 95, "固定收益": 0, "现金": 5}
}


def strict_optimize(target_alloc, pref_type):
    funds, weights = [], []
    if target_alloc["股票"] > 60:
        if pref_type == "Amundi_BEA":
            funds, weights = ["东亚联丰环球股票基金", "东方汇理香港组合-灵活配置增长", "东亚联丰亚洲债券及货币基金"], [0.55, 0.35, 0.10]
        elif pref_type == "JPM_Pictet":
            funds, weights = ["摩根太平洋科技", "摩根亚洲股息", "摩根亚洲总收益", "摩根国际债"], [0.35, 0.30, 0.25, 0.10]
        else:
            funds, weights = ["中银香港环球股票基金", "惠理价值基金", "摩根亚洲总收益", "东亚联丰亚洲债券及货币基金"], [0.30, 0.35, 0.25, 0.10]
    elif target_alloc["股票"] > 40:
        if pref_type == "Amundi_BEA":
            funds, weights = ["东方汇理香港组合-灵活配置均衡", "东亚联丰环球股票基金", "东亚联丰亚洲债券及货币基金"], [0.60, 0.25, 0.15]
        elif pref_type == "JPM_Pictet":
            funds, weights = ["摩根亚洲总收益", "瑞士百达策略收益基金", "摩根太平洋证券", "摩根国际债"], [0.40, 0.30, 0.15, 0.15]
        else:
            funds, weights = ["摩根亚洲总收益", "东方汇理香港组合-灵活配置均衡", "惠理高息股票基金", "摩根国际债"], [0.35, 0.35, 0.15, 0.15]
    else:
        if pref_type == "Amundi_BEA":
            funds, weights = ["东方汇理香港组合-灵活配置平稳", "东亚联丰亚洲债券及货币基金", "东亚联丰环球股票基金"], [0.50, 0.40, 0.10]
        elif pref_type == "JPM_Pictet":
            funds, weights = ["摩根国际债", "瑞士百达策略收益基金", "摩根亚洲总收益"], [0.55, 0.30, 0.15]
        else:
            funds, weights = ["摩根国际债", "东方汇理香港组合-灵活配置平稳", "瑞士百达策略收益基金"], [0.40, 0.40, 0.20]

    achieved = {"股票": 0.0, "固定收益": 0.0, "黄金": 0.0, "现金": 0.0}
    for i, f in enumerate(funds):
        achieved["股票"] += MRF_POOL[f]["股票"] * weights[i]
        achieved["固定收益"] += MRF_POOL[f]["固定收益"] * weights[i]
        achieved["现金"] += MRF_POOL[f]["现金"] * weights[i]
    return funds, weights, achieved


# --- 2. 引导页 (Landing Page) ---
if st.session_state.device is None:
    st.title("🎯 宏观资产配置引擎")
    st.write("请选择入口与设备：")
    # 第一行：宏观资产配置引擎 【手机】【电脑】
    st.subheader("宏观资产配置引擎")
    r1c1, r1c2 = st.columns(2)
    with r1c1:
        st.button("📱 手机", key="cfg_mobile", on_click=set_device, args=("mobile", "config"), use_container_width=True)
    with r1c2:
        st.button("💻 电脑", key="cfg_desktop", on_click=set_device, args=("desktop", "config"), use_container_width=True)
    st.write("")
    # 第二行：WMP NAV 【手机】【电脑】
    st.subheader("WMP NAV")
    r2c1, r2c2 = st.columns(2)
    with r2c1:
        st.button("📱 手机", key="wmp_mobile", on_click=set_device, args=("mobile", "wmp"), use_container_width=True)
    with r2c2:
        st.button("💻 电脑", key="wmp_desktop", on_click=set_device, args=("desktop", "wmp"), use_container_width=True)
    st.stop()

# --- 访客追踪（每会话一次，Supabase 失败静默）---
track_visitor()

# --- 3. 全局合规提示 ---
st.error("⚠️ **合规风险提示**：本模拟器仅作算法演示，不可作为实际交易决策！")

# --- 入口分支：仅 WMP 或 宏观配置（含 WMP Tab）---
if st.session_state.entry == "wmp":
    # 仅展示 WMP 页面，带返回
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
            st.info("暂无净值历史数据。请先点击「抓取今日净值并写入 CSV」，或等待 GitHub Actions 每日自动更新。")
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
    st.stop()

# --- 宏观资产配置引擎：控制台与 4 个 Tab ---
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
st.write(f"当前基准：**渣打 - {risk_level}** (股{target_alloc['股票']}% / 债{target_alloc['固定收益']}% / 金{target_alloc['黄金']}%)")
st.divider()

# --- 4. 渲染核心视图（宏观配置 4 个 Tab）---
def render_mobile_ui(pref_type):
    funds, weights, achieved = strict_optimize(target_alloc, pref_type)

    # 手机端：2x2 网格展示指标
    c1, c2 = st.columns(2)
    c1.metric("📉 股票敞口", f"{achieved['股票']:.1f}%", f"基准: {target_alloc['股票']}%", delta_color="off")
    c2.metric("🛡️ 固收敞口", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
    c3, c4 = st.columns(2)
    gold_delta = achieved["黄金"] - target_alloc["黄金"]
    c3.metric("🥇 黄金敞口", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
    c4.metric("💵 现金敞口", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")

    st.write("---")
    st.write("#### 💼 具体买入清单")
    # 手机端：卡片式流式布局，拒绝横向长表格
    for i, f in enumerate(funds):
        with st.container(border=True):
            st.markdown(f"**{f}**")
            st.markdown(f"**配置权重**: `{weights[i] * 100:.1f}%` ｜ **金额**: `¥{capital * weights[i]:,.0f}`")
            st.caption(f"底层物理持仓: 股{MRF_POOL[f]['股票']}% / 债{MRF_POOL[f]['固定收益']}% / 现{MRF_POOL[f]['现金']}%")


def render_desktop_ui(pref_type):
    funds, weights, achieved = strict_optimize(target_alloc, pref_type)

    # 电脑端：4列一字排开
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📉 穿透后: 股票", f"{achieved['股票']:.1f}%", f"基准: {target_alloc['股票']}%", delta_color="off")
    col2.metric("🛡️ 穿透后: 固收", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
    gold_delta = achieved["黄金"] - target_alloc["黄金"]
    col3.metric("🥇 穿透后: 黄金", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
    col4.metric("💵 穿透后: 现金", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")

    # 电脑端：经典横向数据表
    df = pd.DataFrame({
        "落地基金产品": funds,
        "配置权重(%)": [w * 100 for w in weights],
        "内部持仓 (股/债/现)": [f"{MRF_POOL[f]['股票']}% / {MRF_POOL[f]['固定收益']}% / {MRF_POOL[f]['现金']}%" for f in funds],
        "买入金额": [f"¥ {capital * w:,.2f}" for w in weights]
    })
    st.dataframe(df, use_container_width=True, hide_index=True)


# 宏观资产配置仅保留三个偏好 Tab（WMP 已从首页单独入口进入）
tab_labels = ["🤖 贴近基准", "🏦 偏摩根百达", "🏛️ 偏汇理东亚"] if st.session_state.device == "mobile" else ["🤖 选项 1: 最贴近标准", "🏦 选项 2: 偏好 摩根+百达", "🏛️ 选项 3: 偏好 东方汇理+东亚"]
t1, t2, t3 = st.tabs(tab_labels)

with t1:
    render_mobile_ui("Standard") if st.session_state.device == "mobile" else render_desktop_ui("Standard")
with t2:
    render_mobile_ui("JPM_Pictet") if st.session_state.device == "mobile" else render_desktop_ui("JPM_Pictet")
with t3:
    render_mobile_ui("Amundi_BEA") if st.session_state.device == "mobile" else render_desktop_ui("Amundi_BEA")

# 引擎状态监控（Debug 显影版）：放在页面最底部左侧，下留 50 行空白，不主动被人看见
for _ in range(50):
    st.write("")
st.write("---")
col_left, _ = st.columns([1, 2])
with col_left:
    with st.expander("♏ 引擎状态监控", expanded=False):
        df_visitors, total_ips = fetch_visitor_logs_df()
        st.metric("总独立访客 IP", total_ips)
        st.dataframe(df_visitors, use_container_width=True, hide_index=True)
