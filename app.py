# -*- coding: utf-8 -*-
"""
宏观资产配置优化器 - V8：双端自适应 + 移动端卡片流版
设备选择引导页 + 手机版(2x2 指标 + 卡片流) / 电脑版(侧边栏 + 宽表)
"""
import streamlit as st
import pandas as pd

st.set_page_config(page_title="机构级宏观资产配置引擎", layout="centered", initial_sidebar_state="collapsed")

# --- 0. 状态管理：设备路由 ---
if "device" not in st.session_state:
    st.session_state.device = None


def set_device(device_type):
    st.session_state.device = device_type
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
    st.write("请选择您的设备以获得最佳浏览体验：")
    col1, col2 = st.columns(2)
    with col1:
        st.button("📱 手机版浏览 (推荐)", on_click=set_device, args=("mobile",), use_container_width=True)
    with col2:
        st.button("💻 电脑版浏览", on_click=set_device, args=("desktop",), use_container_width=True)
    st.stop()


# --- 3. 全局合规提示与控制台 ---
st.error("⚠️ **合规风险提示**：本模拟器仅作算法演示，不可作为实际交易决策！")

if st.session_state.device == "mobile":
    # 手机端控制台：不使用侧边栏，直接放顶部
    st.subheader("⚙️ 资产配置参数")
    risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
    capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)
else:
    # 电脑端控制台：保持在侧边栏
    with st.sidebar:
        if st.button("⬅️ 返回设备选择"):
            set_device(None)
        st.header("⚙️ 引擎控制台")
        risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
        capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)

target_alloc = SCB_TARGET[risk_level]
st.write(f"当前基准：**渣打 - {risk_level}** (股{target_alloc['股票']}% / 债{target_alloc['固定收益']}% / 金{target_alloc['黄金']}%)")
st.divider()

# --- 4. 渲染核心视图 ---
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


# 手机端的 Tab 标题要短一点，防止挤压
if st.session_state.device == "mobile":
    t1, t2, t3 = st.tabs(["🤖 贴近基准", "🏦 偏摩根百达", "🏛️ 偏汇理东亚"])
else:
    t1, t2, t3 = st.tabs(["🤖 选项 1: 最贴近标准", "🏦 选项 2: 偏好 摩根+百达", "🏛️ 选项 3: 偏好 东方汇理+东亚"])

with t1:
    render_mobile_ui("Standard") if st.session_state.device == "mobile" else render_desktop_ui("Standard")
with t2:
    render_mobile_ui("JPM_Pictet") if st.session_state.device == "mobile" else render_desktop_ui("JPM_Pictet")
with t3:
    render_mobile_ui("Amundi_BEA") if st.session_state.device == "mobile" else render_desktop_ui("Amundi_BEA")
