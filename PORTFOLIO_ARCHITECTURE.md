# Portfolio 架构说明：标准组合 + 落地基金穿透

便于你研究「点击 Portfolio 时如何同时显示标准组合构成 + 建议 MF 及穿透」。下面按**数据从哪来、谁在算、谁在展示**拆开说明。

---

## 一、两套“标准组合”数据源（别搞混）

| 用途 | 数据来源 | 存放位置 | 资产维度 |
|------|----------|----------|----------|
| **宏观配置页**（当前基准、穿透后股/债/金/现、落地基金表） | 内存字典，**不用数据库** | `app.py` 里 `MODEL_TARGET` | 4 类：股票、固定收益、黄金、现金 |
| **双饼图页**（机构 vs 个人、备注穿透） | SQLite | `d:\house view\portfolio_reports.db`（见 `dual_pie_page.py` 的 `DB_PATH`）→ `portfolio_templates` | 3 类：全球股票、DM投资级债券、黄金 |

- **你要升级的“点击 Portfolio”的“标准组合”**：目前就是 **app.py 里这一套**（`MODEL_TARGET` + 组合推荐函数 + `MRF_POOL`）。
- 数据库里的 `portfolio_templates` 是给双饼图/机构配比用的，和宏观配置页**不是同一张表**。若以后要“标准组合也进库、和图片里的 54%/38%/6% 一致”，需要把 `MODEL_TARGET` 迁到 `portfolio_templates`（或新表）并改 UI 读库。

---

## 二、宏观配置页：标准组合 + 落地基金 + 穿透（全在 app.py）

### 2.1 标准组合的“构成”从哪里来

- **程序**：`app.py`
- **变量**：`MODEL_TARGET`（约 371–375 行）

```python
MODEL_TARGET = {
    "平稳 (Income)":    {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)":  {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3}
}
```

- **展示**：`target_alloc = MODEL_TARGET[risk_level]`，然后一行文案摘要当前风险档位与股/债/金占比。
- 这里**没有**“标准组合的表格”：只有这一行汇总。若要“标准组合的表格构成”，要么在 app.py 里用 `MODEL_TARGET[risk_level]` 画一张表（股/债/金/现 四列），要么以后从 DB 读一张“标准组合明细表”。

### 2.2 “建议的 MF”和“如何配置贴近标准”是谁算的

- **程序**：`app.py`
- **函数**：多套 Tab 组合逻辑（如 `combo_fee_first`、`combo_optimizer`、`combo_diversify` 等），均接收同一 `target_alloc`。

逻辑概要：

- 输入：`target_alloc`（上面那 4 个数），以及各 Tab 的筛选与权重拟合规则。
- 输出：落地基金列表、配置权重，以及穿透后的股/债/金/现占比（由 `MRF_POOL` 加权汇总）。

与根目录 `optimizer.py`（13 维二次规划）是**不同路径**；宏观页当前未直接调用 `optimizer.py`。

### 2.3 “穿透”怎么算（底层如何贴近标准）

- **程序**：`app.py`
- **数据**：`MRF_POOL`（约 126–141 行）：每只基金的**内部持仓**（股/债/现，百分比）

```python
MRF_POOL = {
    "摩根亚洲总收益": {"brand": "JPM", "股票": 50, "固定收益": 45, "现金": 5},
    "摩根国际债":     {"brand": "JPM", "股票": 0, "固定收益": 95, "现金": 5},
    # ...
}
```

- **公式**（在组合计算逻辑中，对权重与 `MRF_POOL` 逐类加总）：
  - 对每类资产（股票/固定收益/现金）：  
    `achieved[该类] = Σ (weights[i] * MRF_POOL[funds[i]][该类])`
  - 黄金：当前 MRF_POOL 里没有黄金，所以一直是 0，页面上显示“缺项”。

也就是说：**“我们选的产品”= 各 Tab 返回的基金列表与权重；“底层如何贴近标准”= 每只基金的 `MRF_POOL` 股/债/现 × 配置权重加总，与 `target_alloc` 对比。**

### 2.4 这些结果在哪里展示

- **程序**：`app.py`
- **桌面端**：`render_desktop_ui(...)`（sidebar + 主区表格/metric）
  - 上面 4 个 metric：穿透后 股票/固收/黄金/现金 vs 基准。
  - 下面一张表：`落地基金产品`、`配置权重(%)`、`内部持仓 (股/债/现)`、`买入金额`。
- **移动端**：`render_mobile_ui(...)`：同一套 `funds/weights/achieved`，用卡片展示。

所以：**“第一个组合我们选的产品”= 当前 Tab 下组合函数返回的 `funds`；“底层用哪些来贴近标准”= 同一张表里的“内部持仓 (股/债/现)”列，数据来自 `MRF_POOL`。**

---

## 三、和数据库有关的程序（双饼图 + 未来可接标准组合）

| 文件 | 作用 |
|------|------|
| `d:\house view\portfolio_reports.db`（可改 `DB_PATH`） | SQLite：`portfolio_templates`（机构标准配比）、`user_portfolio_holdings`（持仓穿透）、`report_segments`（观点/tags） |
| `portfolio_reports_migrate.py` | 建表、seed：平衡型 全球股票 60% / DM 债 30% / 黄金 10%，以及示例持仓 |
| `portfolio_reports_enrich.py` | 给 `report_segments` 打 tags；可插模拟持仓（基金 A/B） |
| `dual_pie_page.py` | 读 `portfolio_templates` + `user_portfolio_holdings`，画双饼图、穿透明细、关联观点；**不读** `MODEL_TARGET` / `MRF_POOL` |

当前**宏观配置页**默认不读该 SQLite；**双饼图页**不读 `MODEL_TARGET` / `MRF_POOL`。两套数据若要统一，需要你在中间做一层“标准组合”的对接（例如把 54/38/6/2 写入或映射到 DB）。

---

## 四、未在宏观配置里用到的模块（可用来升级）

| 文件 | 作用 |
|------|------|
| `optimizer.py` | 13 维资产、`MODEL_PORTFOLIOS`（平稳/均衡/进取）、二次规划求基金权重；**app.py 未 import** |
| `mapping_engine.py` | 把基金底层持仓映射到 13 类标准资产；**app.py 未 import** |

若你希望“标准组合用图片里的细分类（北美/欧洲/日本/亚洲股票 + 各类债券 + 黄金 + 现金）”，可以：
- 用 `optimizer.py` 的 `MODEL_PORTFOLIOS` 或 DB 表表示标准组合；
- 用 `mapping_engine.py` 得到每只基金的 13 维暴露；
- 用 `optimizer.py` 解出权重，再在 app 里展示“落地基金 + 内部持仓（股/债/现或 13 类）”。

---

## 五、你要的“同时显示”对应到代码的哪里

- **标准组合的构成（表格）**  
  - 目前：只有一句当前基准摘要，没有表。  
  - 做法：在 app.py 里用 `target_alloc = MODEL_TARGET[risk_level]` 画一张 4 列表（资产类、目标%）；若以后标准组合进 DB，就改成从 `portfolio_templates`（或新表）读。

- **我们构成的产品（建议 MF）**  
  - 数据：当前 Tab 下组合函数返回的 `funds`、`weights`。  
  - 展示：已有，就是“落地基金产品”那一列 + 配置权重% + 买入金额。

- **分别如何配置达到贴近标准（穿透）**  
  - 数据：`MRF_POOL[基金]` 的股/债/现。  
  - 展示：已有，“内部持仓 (股/债/现)”列；再上面 4 个 metric 是加总后的穿透结果 vs 基准。

总结：**计算“标准组合 + 建议 MF + 穿透”的程序就是 app.py 里的 `MODEL_TARGET`、`MRF_POOL` 与各 Tab 组合函数；数据库侧脚本是 `portfolio_reports_migrate` / `portfolio_reports_enrich` / `dual_pie_page`，和当前宏观配置的“标准+落地+穿透”是两套，要升级成“点击 Portfolio 同时显示标准表 + 落地产品 + 穿透”，就在 app.py 里加“标准组合构成表”并保持沿用现有组合逻辑 + `MRF_POOL` 即可；若要用 13 维或 DB，再接 optimizer / mapping_engine 或 portfolio_templates。**
