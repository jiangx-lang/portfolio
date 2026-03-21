## 目的（给 Claude AI 的对接说明）

你需要在**不改动现有 Streamlit 三个 Tab / 风险选择 / 推荐逻辑**的前提下，让 **Next.js Dashboard 作为“投资分析层”叠加**：

- Streamlit 负责：风险档位选择 → 组合推荐 → 展示“建议落地基金”
- Next.js 负责：基金/股票的**AI 分析**、Top 10 Holdings、股票价格曲线、期权估值温度等
- 两套系统**共享 Supabase 数据**（不重复建库）

---

## 1) 现有运行系统入口文件（Streamlit 主入口）

当前“宏观资产配置优化器（含 MRF 模式 + 三个 Portfolio Tab）”的入口在仓库根目录：

- `d:\portoflio for mrf\app.py`

你要求的几块逻辑都在这个文件中（不是 `qdii_portfolio/app.py`；后者只是 QDII 的多页面路由壳）。

### 1.1 `MRF_POOL` 定义（已有）

`MRF_POOL` 是基金池的核心数据结构（基金名 → brand/股债现/fee_rate），并且**启动时优先从 Supabase `mrf_funds` 拉取**，失败才回退到硬编码。

```324:413:d:\portoflio for mrf\app.py
SCB_TARGET = {
    "平稳 (Income)":     {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)":   {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3},
}

# fee_rate 来自爬虫 updated_funds_fees.xlsx（小数 0.02 表示 2%，已转为百分点 2.0）
MRF_POOL = {
    "东方汇理香港组合-灵活配置增长": {"brand": "Amundi", "股票": 70, "固定收益": 25, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置均衡": {"brand": "Amundi", "股票": 50, "固定收益": 45, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置平稳": {"brand": "Amundi", "股票": 30, "固定收益": 60, "现金": 10, "fee_rate": 3.0},
    // ... 省略：多只基金 ...
}
# 优先从 Supabase mrf_funds 表加载，无则用上表
try:
    from scripts.load_mrf_pool_from_supabase import load_mrf_pool_from_supabase
    _mrf_loaded = load_mrf_pool_from_supabase()
    if _mrf_loaded:
        MRF_POOL = _mrf_loaded
except Exception:
    pass
```

**结论**：`MRF_POOL` 既可以硬编码，也可以由 Supabase `mrf_funds` 直接提供。

### 1.2 左侧风险级别选择（平稳/均衡/进取）

风险档位在 `SCB_TARGET` 中定义，UI 用 `st.selectbox` 选择，之后拿到 `target_alloc`：

```2070:2088:d:\portoflio for mrf\app.py
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
```

### 1.3 三个 Portfolio Tab 的逻辑（Tab1 精选 / Tab2 Model / Tab3 补充）

三个 Tab 的核心是：**先统一算好三套组合**（保证 Tab3 能排除 Tab1/Tab2 已用基金），再渲染到 `st.tabs`：

```2090:2139:d:\portoflio for mrf\app.py
# 三组合：先统一算好再渲染，保证 Tab3 的 used_funds 与 Tab1/Tab2 一致
res_fee = combo_fee_first(target_alloc)
res_opt = combo_optimizer(target_alloc)
used_funds_set = set(res_fee[0]) | set(res_opt[0])
res_div = combo_diversify(target_alloc, used_funds_set)

t1, t2, t3, t4_pdf, t5_podcast = st.tabs(tab_labels)

with t1:
    f1, w1, a1 = res_fee
    waf1 = _weighted_avg_fee(f1, w1)
    render_mobile_ui(...) 或 render_desktop_ui(...)

with t2:
    f2, w2, a2 = res_opt
    render_mobile_ui(...) 或 render_desktop_ui(...)

with t3:
    f3, w3, a3 = res_div
    is_new = [f not in used_funds_set for f in f3]
    render_mobile_ui(...) 或 render_desktop_ui(...)
```

### 1.4 基金推荐算法（手续费优先 / house view 匹配）

三套组合对应三段核心算法函数：

- **Tab1 精选（手续费优先）**：`combo_fee_first(target_alloc)`
- **Tab2 Model（最优匹配）**：`combo_optimizer(target_alloc)`
- **Tab3 补充（差异化）**：`combo_diversify(target_alloc, used_funds_set)`

核心思想是把基金池每只基金的“股/债/现”当成 3 维向量，然后用约束优化（SLSQP）拟合到目标 `target_alloc`。

```507:617:d:\portoflio for mrf\app.py
def _minimize_weights_3d(fund_names: list, target_alloc: dict):
    """
    3 维（股/债/现）加权最小二乘：min ||Aw - b||^2, sum(w)=1, w>=0。
    """
    // A 为每只基金的股/债/现比例矩阵，b 为目标比例
    res = minimize(obj, w0, method="SLSQP", bounds=bounds, constraints=cons)
    // 剔除权重 < 3% 的碎股，重新归一化
    return funds_kept, weights_kept

def combo_fee_first(target_alloc: dict):
    """
    Tab1 最高费率配置：候选为申购费 >= FEE_FIRST_MIN_FEE...
    """
    // 1) 候选池：fee_rate >= 阈值；排除特定债券基金；必要时补一个债券 proxy
    // 2) 对候选池做 _minimize_weights_3d 拟合
    // 3) 额外剔除 <10% 权重碎单（MIN_WEIGHT_DISPLAY）
    return funds, weights, achieved

def combo_optimizer(target_alloc: dict):
    """
    Tab2 最优配置组合：不限制基金数量，全池拟合...
    """
    return funds, weights, achieved

def combo_diversify(target_alloc: dict, used_funds_set: set):
    """
    Tab3 补充方案：排除 Tab1+Tab2 已用基金... fee 放宽到 1.5~3.0...
    """
    // 还会尝试从 used_funds_set 里挑一个“最高费率”的股/债产品补回，避免单侧缺失
    return funds, weights, achieved
```

### 1.5 “建议落地基金”表格的数据来源

“建议落地基金 & 底层穿透”表格的数据是由 `render_fund_penetration_table(funds, weights, capital, ...)` 生成：

- `funds/weights` 来自 Tab1/Tab2/Tab3 的算法结果
- 品牌/股债现/申购费来自 `MRF_POOL[fund_name]`
- 买入金额来自 `capital * weight`

```688:727:d:\portoflio for mrf\app.py
def render_fund_penetration_table(funds, weights, capital, weighted_avg_fee=None, is_new_fund=None):
    st.markdown("### 💼 建议落地基金 & 底层穿透")
    base = {
        "落地基金产品": funds,
        "品牌": [MRF_POOL[f]["brand"] for f in funds],
        "配置权重(%)": [round(w * 100, 1) for w in weights],
        "申购费率(%)": [round(MRF_POOL[f].get("fee_rate") or 0.0, 2) for f in funds],
        "底层: 股票%": [MRF_POOL[f]["股票"] for f in funds],
        "底层: 固收%": [MRF_POOL[f]["固定收益"] for f in funds],
        "底层: 现金%": [MRF_POOL[f]["现金"] for f in funds],
        "买入金额(¥)": [round(capital * w) for w in weights],
    }
    st.dataframe(df, ...)
```

---

## 2) 渣打 House View / Model Portfolio 数据（SCB 基准在哪里定义？）

### 2.1 在根目录 `app.py` 中的定义（MRF 资产配置引擎使用）

`SCB_TARGET`（顶层 股票/债券/黄金/现金）与 `SCB_DETAIL`（二级细分）是**硬编码在根目录 `app.py`**：

```324:366:d:\portoflio for mrf\app.py
SCB_TARGET = {
    "平稳 (Income)":     {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)":   {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3},
}

SCB_DETAIL = {
    "平稳 (Income)": {...},
    "均衡 (Balanced)": {...},
    "进取 (Aggressive)": {...},
}
```

**结论**：当前 SCB 基准与目标比例是硬编码，不在数据库。

### 2.2 在 `qdii_portfolio/data/benchmarks.py` 中的定义（QDII 组合构建器用）

QDII 的“组合构建器（portfolio_builder）”用的是 `BENCHMARKS`，也在代码中硬编码：

```1:48:d:\portoflio for mrf\qdii_portfolio\data\benchmarks.py
BENCHMARKS: dict[str, dict[str, float]] = {
    "渣打保守型 Conservative": {...},
    "渣打稳健型 Balanced": {...},
    "渣打成长型 Growth": {...},
}
```

**结论**：QDII 这边的基准同样是硬编码文件，可替换成真实 CIO 数据源但结构不变。

---

## 3) 基金推荐逻辑（核心代码位置与要点）

### 3.1 怎么从 `MRF_POOL` 选出“精选 Portfolio”（手续费优先）

Tab1 的候选池筛选逻辑（费率优先）在 `combo_fee_first`：

- 只从可用池里选（排除 `EXCLUDED_FUNDS`）
- fee_rate >= `FEE_FIRST_MIN_FEE`（默认 2.5%）
- 排除 `FEE_FIRST_EXCLUDE_BOND_FUNDS`（默认排除“摩根国际债”）
- 如果候选里没有“高固收”产品，会补一个 `PREFERRED_BOND_PROXY`（默认“东方汇理灵活配置平稳”）

```397:567:d:\portoflio for mrf\app.py
EXCLUDED_FUNDS = {"东亚联丰亚洲债券及货币基金"}
FEE_FIRST_MIN_FEE = 2.5
FEE_FIRST_EXCLUDE_BOND_FUNDS = {"摩根国际债"}
PREFERRED_BOND_PROXY = "东方汇理香港组合-灵活配置平稳"

def combo_fee_first(target_alloc: dict):
    pool = _pool_without_excluded()
    high_fee = [f for f in pool if (MRF_POOL[f].get("fee_rate") or 0) >= min_fee and f not in FEE_FIRST_EXCLUDE_BOND_FUNDS]
    has_bond = any(MRF_POOL[f]["固定收益"] > 60 for f in high_fee)
    if not has_bond ...: high_fee.append(PREFERRED_BOND_PROXY)
    funds, weights = _minimize_weights_3d(selected, target_alloc)
    funds, weights = _drop_small_weights(funds, weights)
```

### 3.2 手续费优先怎么排序？

Tab1 不直接“排序取前 N”，而是：

- 先用 fee_rate 阈值筛出高费率候选池（等价于“手续费优先”）
- 再在候选池里用优化器拟合风险目标
- 最后剔除权重太小的基金（<10%）

fee 的使用点包括：

- 筛选候选池：`(MRF_POOL[f].get("fee_rate") or 0) >= min_fee`
- 落地基金表展示：`"申购费率(%)": round(MRF_POOL[f].get("fee_rate") or 0.0, 2)`
- 组合加权费率：`Σ (w * fee_rate)`

### 3.3 怎么匹配用户的风险偏好？

用户选择 `risk_level`（平稳/均衡/进取）后：

- `target_alloc = SCB_TARGET[risk_level]`
- 三个组合函数都接收 `target_alloc`，用同一个 3D 拟合器 `_minimize_weights_3d(...)` 去匹配目标的股/债/现比例。

---

## 4) 现有系统的数据接口（是否有 API endpoint？）

### 4.1 `qdii_portfolio/app.py` 是否包含 API endpoint

`qdii_portfolio/app.py` 是 Streamlit 多页面路由入口，只有一个函数：

- `def set_device(device_type: str): ...`

没有看到任何类似 Flask/FastAPI 的 route/endpoint 装饰器，也没有 `st.json` 或 `@app` 字样。

文件：`d:\portoflio for mrf\qdii_portfolio\app.py`

### 4.2 Next.js Dashboard 的 API endpoint（用于“投资分析层”）

Next.js（`mf-holdings-dashboard`）侧已存在大量 API route（例如 `/api/mrf/holdings/[code]`、`/api/analyze`、`/api/analysis`、`/api/stock-history/[ticker]` 等），用于：

- 从 Supabase 读基金/持仓/AI 缓存
- 调 Groq 生成 AI 分析并写入 Supabase 缓存
- 提供 mock/真实数据的股票历史曲线接口

---

## 5) 净值数据（MRF 基金净值在哪里？是否有历史净值？）

### 5.1 根目录 `app.py` 的 NAV 数据来源（本地 CSV / GitHub Raw）

`app.py` 顶部定义了 NAV 的默认数据源：

- 本地：`data/nav/{fund_name}.csv`
- 远端（部署用）：`GITHUB_RAW_BASE = https://raw.githubusercontent.com/.../data/nav/`

```21:24:d:\portoflio for mrf\app.py
NAV_DATA_DIR = Path(__file__).resolve().parent / "data" / "nav"
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/jiangx-lang/portfolio/master/data/nav/"
```

### 5.2 `app.py` 末尾对 `load_fund_nav` 做了 Supabase override（优先用 Supabase）

在文件末尾，`load_fund_nav` 被“patch override”为：

1) 若配置了 `SUPABASE_URL/KEY`：从 Supabase
   - `fund_list` 表：用 `code=fund_name` 查 `isin, ccy`
   - `nav_history` 表：按 `isin+ccy` 取 `nav_date, nav`
2) 否则回退到 CSV/GitHub Raw

```2173:2210:d:\portoflio for mrf\app.py
def load_fund_nav(fund_name: str) -> pd.DataFrame:
    try:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_KEY", "")
        if url and key:
            sb = create_client(url, key)
            r = sb.table("fund_list").select("isin,ccy").eq("code", fund_name).execute()
            if r.data:
                isin = r.data[0]["isin"]
                ccy = r.data[0]["ccy"]
                r2 = sb.table("nav_history").select("nav_date,nav").eq("isin", isin).eq("ccy", ccy).order("nav_date").execute()
                if r2.data:
                    // ... 转成 date/nav DataFrame ...
                    return df
    except Exception:
        pass
    # fallback: CSV / GitHub Raw
```

**结论**：

- MRF 净值可来自 **Supabase（`fund_list` + `nav_history`）** 或 CSV。
- 存在历史净值，Streamlit 已经能画“净值走势”；Next.js 也可复用同一份 `nav_history` 数据。

---

## 6) `qdii_portfolio` 文件结构（Python）

当前 `qdii_portfolio` 下的 `.py` 文件（全量就这些，数量不大）：

- `qdii_portfolio/app.py`
- `qdii_portfolio/check_supabase_env.py`
- `qdii_portfolio/show_schema.py`
- `qdii_portfolio/show_data.py`
- `qdii_portfolio/data/__init__.py`
- `qdii_portfolio/data/benchmarks.py`
- `qdii_portfolio/data/fund_meta_builder.py`
- `qdii_portfolio/data/miss_store.py`
- `qdii_portfolio/data/tag_aliases.py`
- `qdii_portfolio/pages/__init__.py`
- `qdii_portfolio/pages/admin.py`
- `qdii_portfolio/pages/fund_detail.py`
- `qdii_portfolio/pages/miss_log.py`
- `qdii_portfolio/pages/nav_chart.py`
- `qdii_portfolio/pages/portfolio_builder.py`
- `qdii_portfolio/pages/theme_search.py`
- `qdii_portfolio/scripts/load_mrf_pool_from_supabase.py`

（注：你最初猜的 `data/benchmarks.py` 确实存在；其内容为硬编码 `BENCHMARKS`。）

---

## 对接落地建议（不改 Streamlit，只叠加 Next.js）

### 目标用户路径

1) 用户在 Streamlit（`app.py`）选择风险档位（SCB 基准）  
2) Tab1/Tab2/Tab3 得到“建议落地基金”  
3) 对某只基金点击“查看详细分析”  
4) 跳转到 Next.js：
   - `/mrf`：基金 Top 10 Holdings + AI 分析
   - holdings 里可点击穿透到 `/stock/[ticker]`：股票走势 + AI 买入分析 + 期权温度

### 数据共享方式（推荐）

- Streamlit & Next.js **共同读取**：
  - `mrf_funds`（基金池、费率、sc_product_code）
  - `mrf_holdings`（Top 10 holdings）
  - `fund_ai_analysis`（AI 缓存）
  - `fund_list` + `nav_history`（基金净值历史）

### 最小改动点（Streamlit 侧）

- 在“建议落地基金”表格中给每只基金加一个链接按钮：
  - 例如：`查看详细分析` → 打开 Next.js `/mrf?code=...` 或 `/mrf` 并自动展开该基金
  - 或者若基金能映射到股票 ticker，则跳 `/stock/[ticker]`

（Next.js 侧已经实现 MRF 持仓点击跳 `/stock/[ticker]` 与股票价格曲线接口。）

