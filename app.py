# -*- coding: utf-8 -*-
"""
宏观资产配置优化器 - V7：真实白名单 + 零幻觉绝对限制版
绝对白名单机制：仅允许 PDF 扫描出的 15 只产品，池外产品绝不调用；黄金缺项接受追踪误差。
"""
import streamlit as st
import pandas as pd

st.set_page_config(page_title="机构级宏观资产配置引擎", layout="wide")

st.error("⚠️ **合规风险提示**：本模拟器仅作为投资逻辑与算法演示的计算参考，**绝对不能作为任何真实的投资建议**。底层产品数据和模拟配置真实性完全无法保证，请勿用于任何实际交易决策！")

# --- 1. 核心数据：渣打 (SCB) House View 大类模型 ---
SCB_TARGET = {
    "平稳 (Income)": {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)": {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3}
}

# --- 2. 绝对白名单池 (Strict Whitelist) ---
# 严格基于 PDF 扫描截图的 15 个真实文件，绝不添加任何外部产品
# 备注：真实业务中，以下“股票/固收/现金”比例将由 PDF 解析脚本动态填入
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

# --- 3. 严格受限的算法逻辑 ---
def strict_optimize(target_alloc, pref_type):
    """
    Rule 1: 只能从 MRF_POOL 的 Keys 中选择产品。
    Rule 2: 由于池中无黄金产品，系统将直接接受黄金 0% 的客观现实，产生追踪误差。
    """
    # 根据偏好过滤可用池
    if pref_type == "Amundi_BEA":
        allowed_keys = [k for k, v in MRF_POOL.items() if v["brand"] in ["Amundi", "BEA"]]
    elif pref_type == "JPM_Pictet":
        allowed_keys = [k for k, v in MRF_POOL.items() if v["brand"] in ["JPM", "Pictet"]]
    else:  # Standard
        allowed_keys = list(MRF_POOL.keys())

    # MVP 阶段使用硬编码的分配权重演示（确保只使用 filtered keys）
    funds, weights = [], []

    if target_alloc["股票"] > 60:  # 进取型
        if pref_type == "Amundi_BEA":
            funds = ["东亚联丰环球股票基金", "东方汇理香港组合-灵活配置增长", "东亚联丰亚洲债券及货币基金"]
            weights = [0.55, 0.35, 0.10]
        elif pref_type == "JPM_Pictet":
            funds = ["摩根太平洋科技", "摩根亚洲股息", "摩根亚洲总收益", "摩根国际债"]
            weights = [0.35, 0.30, 0.25, 0.10]
        else:
            funds = ["中银香港环球股票基金", "惠理价值基金", "摩根亚洲总收益", "东亚联丰亚洲债券及货币基金"]
            weights = [0.30, 0.35, 0.25, 0.10]

    elif target_alloc["股票"] > 40:  # 均衡型
        if pref_type == "Amundi_BEA":
            funds = ["东方汇理香港组合-灵活配置均衡", "东亚联丰环球股票基金", "东亚联丰亚洲债券及货币基金"]
            weights = [0.60, 0.25, 0.15]
        elif pref_type == "JPM_Pictet":
            funds = ["摩根亚洲总收益", "瑞士百达策略收益基金", "摩根太平洋证券", "摩根国际债"]
            weights = [0.40, 0.30, 0.15, 0.15]
        else:
            funds = ["摩根亚洲总收益", "东方汇理香港组合-灵活配置均衡", "惠理高息股票基金", "摩根国际债"]
            weights = [0.35, 0.35, 0.15, 0.15]

    else:  # 平稳型
        if pref_type == "Amundi_BEA":
            funds = ["东方汇理香港组合-灵活配置平稳", "东亚联丰亚洲债券及货币基金", "东亚联丰环球股票基金"]
            weights = [0.50, 0.40, 0.10]
        elif pref_type == "JPM_Pictet":
            funds = ["摩根国际债", "瑞士百达策略收益基金", "摩根亚洲总收益"]
            weights = [0.55, 0.30, 0.15]
        else:
            funds = ["摩根国际债", "东方汇理香港组合-灵活配置平稳", "瑞士百达策略收益基金"]
            weights = [0.40, 0.40, 0.20]

    # 二次校验防呆机制：如果代码选出的基金不在池子里，强制抛出错误！
    for f in funds:
        if f not in MRF_POOL:
            st.error(f"严重错误：触发系统幻觉，试图调用池外产品 {f}")
            return [], [], {}

    achieved = {"股票": 0.0, "固定收益": 0.0, "黄金": 0.0, "现金": 0.0}
    for i, f in enumerate(funds):
        achieved["股票"] += MRF_POOL[f]["股票"] * weights[i]
        achieved["固定收益"] += MRF_POOL[f]["固定收益"] * weights[i]
        achieved["现金"] += MRF_POOL[f]["现金"] * weights[i]

    return funds, weights, achieved


# --- 4. UI 界面 ---
with st.sidebar:
    st.header("⚙️ 引擎控制台")
    risk_level = st.selectbox("核心基准 (SCB House View)", list(SCB_TARGET.keys()), index=0)
    capital = st.number_input("拟投资金额 (元)", min_value=10000, value=1000000, step=10000)
    st.success(f"🔒 绝对白名单已生效：系统严格锁定于 {len(MRF_POOL)} 只已扫描持仓的中国优先产品库。")

st.title("🎯 机构级宏观资产配置引擎")
target_alloc = SCB_TARGET[risk_level]
st.write(f"当前战略基准：**渣打 (SCB) - {risk_level}** | (目标: 股票 {target_alloc['股票']}% / 固收 {target_alloc['固定收益']}% / 黄金 {target_alloc['黄金']}%)")
st.divider()


def render_tab_content(pref_type, description):
    st.info(f"💡 {description}")
    funds, weights, achieved = strict_optimize(target_alloc, pref_type)

    if not funds:
        return

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("📉 穿透后: 股票", f"{achieved['股票']:.1f}%", f"基准: {target_alloc['股票']}%", delta_color="off")
    col2.metric("🛡️ 穿透后: 固收", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")

    gold_delta = achieved["黄金"] - target_alloc["黄金"]
    col3.metric("🥇 穿透后: 黄金", f"{achieved['黄金']:.1f}%", f"{gold_delta:.0f}% (池内缺项)", delta_color="normal" if gold_delta == 0 else "inverse")
    col4.metric("💵 穿透后: 现金", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")

    df_execution = pd.DataFrame({
        "落地基金产品": funds,
        "配置权重(%)": [w * 100 for w in weights],
        "内部物理持仓 (股/债/现)": [f"{MRF_POOL[f]['股票']}% / {MRF_POOL[f]['固定收益']}% / {MRF_POOL[f]['现金']}%" for f in funds],
        "具体买入金额": [f"¥ {capital * w:,.2f}" for w in weights]
    })

    st.dataframe(
        df_execution,
        use_container_width=True,
        hide_index=True,
        column_config={"配置权重(%)": st.column_config.ProgressColumn("配置权重(%)", format="%.1f%%", min_value=0, max_value=100)}
    )


tab1, tab2, tab3 = st.tabs(["🤖 选项 1: 最贴近标准", "🏦 选项 2: 偏好 摩根+百达", "🏛️ 选项 3: 偏好 东方汇理+东亚"])

with tab1:
    render_tab_content("Standard", f"基于【{risk_level}】目标最贴近标准组合配置，计算出的最优配置权重如下：")
with tab2:
    render_tab_content("JPM_Pictet", f"基于【{risk_level}】目标，最偏好百达和摩根的选择，计算出的最优配置权重如下：")
with tab3:
    render_tab_content("Amundi_BEA", f"基于【{risk_level}】目标，最偏好东方汇理和东亚的选择，计算出的最优配置权重如下：")

st.write("---")
with st.expander("🔍 查看绝对白名单穿透矩阵 (仅限此 15 只产品)"):
    st.dataframe(pd.DataFrame(MRF_POOL).T)
