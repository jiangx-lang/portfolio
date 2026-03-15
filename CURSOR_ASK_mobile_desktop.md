# 技术询问：QDII 系统手机端适配现状 — 答复

---

## 问题 1：app.py 当前的 layout 设置

在 `qdii_portfolio/app.py` 中：

- **`layout`**：`layout="wide"`
- **`initial_sidebar_state`**：`"expanded"`

即当前为宽屏布局，侧栏默认展开，**没有**按设备区分配置。

---

## 问题 2：各页面 st.columns 使用情况

| 文件 | 位置（行号） | 列数 | 说明 |
|------|--------------|------|------|
| **theme_search.py** | 167 | **8 列** | `st.columns(8)` 预设主题 pills |
| | 183 | 2 列 | 搜索输入 + 按钮 `[5, 1]` |
| | 227 | 2 列 | 结果区 |
| | 251 | **5 列** | 表头 `[3, 1.5, 1.2, 3, 2.5]` |
| | 258 | **5 列** | 表格行同上 |
| **portfolio_builder.py** | 90 | **6 列** | `st.columns(len(PRESET_THEMES[:6]))` 预设主题 |
| | 100 | 2 列 | 左右 `[1, 1]` |
| | 109 | 3 列 | 选基/权重等 `[4, 1.2, 0.5]` |
| **miss_log.py** | 27 | 2 列 | |
| | 34 | 2 列 | `[2, 1]` |
| | 58 | 4 列 | 列表行 `[3, 2, 2, 1]` |
| **admin.py** | 28 | 3 列 | 统计 metric |
| **nav_chart.py**（项目根） | 177 | 3 列 | `[3, 2, 2]` 基金选择/区间/对比指数 |
| | 250 | 动态列 | `st.columns(len(fund_s))` 摘要卡 |

**多列（>2）重点**：theme_search 的 8 列 + 5 列表格、portfolio_builder 的 6 列、miss_log 的 4 列、nav_chart 的 3 列及动态列。这些在窄屏上最容易挤或横向滚动。

---

## 问题 3：有没有任何手机/电脑判断逻辑？

在 **`qdii_portfolio/`** 目录下：

- **没有**在 `st.session_state` 里存设备类型（如 `device`）的代码
- **没有** User-Agent 检测
- **没有** 任何 `mobile` / `desktop` 相关变量或分支

结论：**QDII 当前未做设备区分，所有页面共用同一套宽屏布局。**

---

## 问题 4：MRF 系统是怎么做手机/电脑分离的？

### 4.1 `set_device()` 定义（约 189–194 行）

```python
def set_device(device_type, entry_type="config"):
    st.session_state.device = device_type
    st.session_state.entry = entry_type
    if entry_type != "admin":
        threading.Thread(target=track_page_entry, args=(entry_type,), daemon=True).start()
    st.rerun()
```

作用：把用户选择的 **设备类型**（`mobile` / `desktop`）和 **入口类型**（config / wmp / notes / podcast / admin）写入 `st.session_state`，然后 `st.rerun()` 刷新页面。设备类型**不是**通过 User-Agent 自动检测，而是**首页按钮「📱 手机」「💻 电脑」手动选择**。

### 4.2 手机/电脑布局入口函数

- **电脑端**：`render_desktop_ui()`（约 930 行）
- **手机端**：`render_mobile_ui()`（约 1006 行）

主流程分支（约 1884、1961、1993–2024 行）：

- 侧栏「返回首页」：desktop 在 sidebar，mobile 在正文顶部按钮
- 参数区（投资目标、金额）：desktop 在 sidebar，mobile 在正文顶部
- 三个 Tab 的结果：`if is_mobile: render_mobile_ui(...) else: render_desktop_ui(...)`

### 4.3 主要区别（摘录）

| 方面 | 电脑端 (desktop) | 手机端 (mobile) |
|------|------------------|------------------|
| **布局** | 左右并排多列（如 `st.columns([1,1])`、`st.columns(len(funds))`） | 单列竖向，用 `st.expander` 折叠次要信息 |
| **穿透指标** | `render_penetration_metrics(..., device="desktop")` → 4 列横排 | 同函数 `device="mobile"` → 2×2 两行 |
| **基金卡片** | 多列并排，每只基金一列 | 竖向逐个 `st.container(border=True)` |
| **自定义构建器** | `st.multiselect` 选基金 | 一列 `st.checkbox` 列表（避免 multiselect 在小屏难用） |
| **自定义结果 metric** | 4 列横排 | 2×2 两行 |

即：**同一套数据与逻辑，两套 UI——桌面多列/侧栏，手机单列/折叠/2×2。**

---

## 问题 5：MRF 中相关代码片段（便于对照）

### `render_penetration_metrics`（约 648–663 行）

```python
def render_penetration_metrics(achieved: dict, target_alloc: dict, device: str = "desktop"):
    """显示穿透后各资产类别 vs 基准对比（4 个 metric）"""
    if device == "mobile":
        c1, c2 = st.columns(2)
        c1.metric("📉 股票敞口",  f"{achieved['股票']:.1f}%", ...)
        c2.metric("🛡️ 固收敞口", ...)
        c3, c4 = st.columns(2)
        c3.metric("🥇 黄金敞口", ...)
        c4.metric("💵 现金敞口", ...)
    else:
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("📉 穿透后: 股票", ...)
        # ... 4 列横排
```

### 主入口分支（约 1961–1970、1993–2024）

```python
if st.session_state.device == "mobile":
    st.subheader("⚙️ 资产配置参数")
    risk_level = st.selectbox(...)
    capital = st.number_input(...)
else:
    with st.sidebar:
        st.button("⬅️ 返回首页", ...)
        risk_level = st.selectbox(...)
        capital = st.number_input(...)
# ...
if is_mobile:
    render_mobile_ui(...)
else:
    render_desktop_ui(...)
```

---

## 基于 MRF 模式对 QDII 的优化评估

### 建议优化优先级与工作量（粗估）

| 页面 | 现状问题 | 建议 | 工作量（人天，估） |
|------|----------|------|-------------------|
| **theme_search.py** | 8 列 pills + 5 列表格，手机易横向挤/滚动 | 设备分支：手机改为 2–3 列或竖向列表/折叠；表格改为单列卡片或 2 列 | 1–1.5 |
| **portfolio_builder.py** | 6 列预设主题 + 多列选基/权重 | 手机：主题 2 列或纵向；选基区单列；与 theme_search 类似模式 | 1–1.5 |
| **nav_chart.py** | 3 列 + 动态列摘要卡 | 手机：上中下堆叠（基金/区间/指数）；摘要卡 2 列或单列 | 0.5–1 |
| **miss_log.py** | 2/4 列 | 手机：4 列改 2×2 或单列 | 0.5 |
| **admin.py** | 3 列 metric | 手机：2+1 或单列 | 0.25 |

### 公共部分（若采用 MRF 同款「手动选设备」）

- 在 **qdii_portfolio/app.py** 增加：
  - `st.session_state.device` 初始化与持久化
  - 类似 MRF 的 **`set_device(device_type)`** + 首页/顶栏「📱 手机 / 💻 电脑」切换
- 若希望**不**改首页，可只在侧栏顶部放一个「📱 手机布局 / 💻 电脑布局」切换，逻辑与 MRF 一致，只是入口位置不同。

**总工作量粗估**：约 **3.5–5 人天**（含公共入口 + 5 个页面按设备分支与布局调整）。若只做 theme_search + portfolio_builder + nav_chart 三个最挤的页面，约 **2.5–4 人天**。

---

## 小结

- QDII 当前：**layout="wide"**，无设备判断，多页大量 **st.columns(4~8)**，手机端会挤或横滚。
- MRF：**手动选设备** → `st.session_state.device` → **两套入口函数**（`render_desktop_ui` / `render_mobile_ui`）+ 公用组件内 `device` 参数（如 4 列 vs 2×2）。
- 对 QDII：建议先做 **theme_search、portfolio_builder、nav_chart** 的设备分支与列数/布局收敛，再视需要补 miss_log、admin；公共部分增加与 MRF 同款的 `set_device` 与切换按钮即可复用同一套「手机/电脑分离」模式。
