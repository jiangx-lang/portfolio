# QDII Portfolio System

基于渣打 Model Portfolio 的 QDII 主题化基金配置与净值展示系统。包含主题基金搜索、组合构建器、未命中记录、管理后台，以及历史业绩曲线（数据源支持 Supabase 云端 / 本地 SQLite）。

---

## 项目结构

```
.
├── README.md                 # 本文件
├── requirements.txt          # Python 依赖（Streamlit / Supabase / pandas / yfinance 等）
├── .gitignore                # 已忽略 .env、*.db 等
│
├── qdii_portfolio/           # Streamlit 应用（主入口）
│   ├── app.py                # 主入口，加载 .env、配置 fund_tagging.db、侧栏导航
│   ├── requirements.txt     # 应用依赖（可与根目录合并）
│   ├── .env.example         # 环境变量模板（复制为 .env 并填写）
│   ├── .env                 # 本地配置（勿提交）：SUPABASE_URL、SUPABASE_KEY、NAV_HISTORY_DB
│   ├── check_supabase_env.py # 检查 .env 与 Supabase 连接是否正常
│   ├── fund_tagging.db      # 本地标签库 SQLite（可被 --db 覆盖）
│   ├── pages/
│   │   ├── theme_search.py   # 主题基金搜索
│   │   ├── portfolio_builder.py  # 组合构建器
│   │   ├── miss_log.py      # 未命中记录
│   │   └── admin.py         # 管理后台
│   └── data/
│       ├── tag_aliases.py   # 搜索别名、预设主题
│       ├── benchmarks.py    # 基准配置
│       ├── miss_store.py    # 未命中存储
│       └── fund_meta_builder.py  # 基金元数据生成
│
├── fund_tagging/             # 标签引擎（Bottom-Up：持仓打标 → 基金聚合）
│   ├── schema.sql           # 表结构：tag_taxonomy, holding_tag_map, fund_holding_exposure, fund_tag_map
│   ├── db.py                # configure(db_path)、get_conn()、init_schema()
│   ├── run.py               # CLI：ingest / seed / tag / aggregate / search / fund / stats
│   ├── ingestion.py         # CSV → fund_holding_exposure
│   ├── holding_tagger.py    # 规则打标、upsert holding_tag_map
│   ├── aggregation.py       # 聚合到 fund_tag_map
│   ├── search.py            # FundSearchEngine
│   └── seed_tags.py         # 初始 taxonomy + 示例 holding_tag_map
│
├── supabase_sync.py          # 本地 nav_history.db → Supabase（供 Streamlit Cloud 读净值）
├── nav_chart.py             # 独立页：QD 基金历史业绩曲线（Supabase / 本地 SQLite 自动切换）
├── migrate_to_your_taxonomy.py  # 将现有 tag 体系迁移到 64 条固定 taxonomy
└── CURSOR_PROMPT_supabase_setup.md  # Supabase 建表与部署说明（参考）
```

---

## 环境要求

- Python 3.10+
- 本地可选：`E:\FinancialData\nav_history.db`（若用本地净值）；Supabase 项目（若用云端净值）

---

## 本地运行（先跑通再 push）

### 1. 安装依赖

```bash
# 项目根目录
pip install -r requirements.txt
# 若用 .env 加载 Supabase，需安装
pip install python-dotenv
```

### 2. 配置环境变量（可选：用于净值曲线云端数据）

在 `qdii_portfolio/` 下复制 `.env.example` 为 `.env`，填入：

- `SUPABASE_URL`：Supabase 项目 URL（如 `https://xxxxx.supabase.co`）
- `SUPABASE_KEY`：anon / publishable key
- `NAV_HISTORY_DB`：本地净值库路径（如 `E:\FinancialData\nav_history.db`）

校验连接：

```bash
cd qdii_portfolio
python check_supabase_env.py
```

### 3. 初始化标签库（首次必做）

在项目根执行（会创建 `qdii_portfolio/fund_tagging.db` 并建表、写入种子数据）：

```bash
py -m fund_tagging.run --db qdii_portfolio/fund_tagging.db seed
```

可选：导入持仓 CSV 并打标、聚合：

```bash
py -m fund_tagging.run --db qdii_portfolio/fund_tagging.db ingest --csv top_holdings_detail.csv
py -m fund_tagging.run --db qdii_portfolio/fund_tagging.db tag
py -m fund_tagging.run --db qdii_portfolio/fund_tagging.db aggregate
```

### 4. 启动 Streamlit

```bash
cd qdii_portfolio
streamlit run app.py
# 或指定数据库路径
streamlit run app.py -- --db ./fund_tagging.db
```

浏览器打开 **http://localhost:8501**，使用侧栏：主题基金搜索、组合构建器、未命中记录、管理后台。

### 5. 历史业绩曲线（独立页）

若需单独打开「QD 基金历史业绩」页（多基金对比、区间、基准线）：

```bash
# 项目根
streamlit run nav_chart.py
```

数据源：有 `SUPABASE_URL` / `SUPABASE_KEY` 时用 Supabase，否则用本地 `NAV_HISTORY_DB`。

---

## Supabase 与净值同步（Streamlit Cloud 用）

- **原因**：Streamlit Cloud 无法访问你本地的 `nav_history.db`；GitHub 单文件 100MB 限制，不适合传大库。用 Supabase 做中转，本地下载脚本定期同步即可。
- **流程概览**：
  1. 在 Supabase SQL Editor 执行建表 SQL（见 `supabase_sync.py` 内 `SUPABASE_DDL` 或 `CURSOR_PROMPT_supabase_setup.md`）。
  2. 本地配置 `qdii_portfolio/.env` 的 `SUPABASE_URL`、`SUPABASE_KEY`。
  3. 首次全量同步：在项目根运行 `python supabase_sync.py --all`，再 `python supabase_sync.py --check` 验证。
  4. 在本地下载脚本（如 `D:\MF\qd_download_nav.py`）末尾加入调用 `supabase_sync.sync(days=7)` 等，实现每日增量同步。
  5. Streamlit Cloud 在 Settings → Secrets 中配置 `SUPABASE_URL`、`SUPABASE_KEY`，应用内即可读 Supabase 净值。

详细步骤见 **CURSOR_PROMPT_supabase_setup.md**。

---

## fund_tagging CLI 速查

在项目根执行（`--db` 指向实际使用的 SQLite 路径，如 `qdii_portfolio/fund_tagging.db`）：

| 命令 | 说明 |
|------|------|
| `py -m fund_tagging.run --db <db> seed` | 建表 + 写入 taxonomy 与示例 holding 标签 |
| `py -m fund_tagging.run --db <db> ingest --csv <path>` | CSV 持仓 → fund_holding_exposure |
| `py -m fund_tagging.run --db <db> tag` | 规则打标 → holding_tag_map |
| `py -m fund_tagging.run --db <db> aggregate` | 聚合 → fund_tag_map |
| `py -m fund_tagging.run --db <db> search --themes "AI,Technology" --limit 10` | 按主题搜索基金 |
| `py -m fund_tagging.run --db <db> stats` | 打印库内统计 |

---

## 迁移标签体系（migrate_to_your_taxonomy.py）

若要将现有 tag 体系统一为 64 条固定 taxonomy（含 region/sector/theme/style/custom/asset_class）：

```bash
python migrate_to_your_taxonomy.py --db qdii_portfolio/fund_tagging.db --dry-run   # 预览
python migrate_to_your_taxonomy.py --db qdii_portfolio/fund_tagging.db --run        # 执行
python migrate_to_your_taxonomy.py --db qdii_portfolio/fund_tagging.db --verify     # 校验
```

---

## 部署：GitHub + Streamlit Cloud / 腾讯云

1. **不要提交**：`.env`、`*.db`（已在 `.gitignore`）。
2. **Push 到 GitHub**：正常 `git add` / `commit` / `push` 应用与 `fund_tagging`、`supabase_sync.py`、`nav_chart.py` 等。
3. **Streamlit Cloud**：连 GitHub 仓库，主模块填 `qdii_portfolio/app.py`，在 Settings → Secrets 中配置 `SUPABASE_URL`、`SUPABASE_KEY`，即可在云端显示 Supabase 中的净值曲线。
4. **腾讯云**：按你现有方式（云函数 / 容器 / 静态托管等）部署；在运行环境中配置 `SUPABASE_URL`、`SUPABASE_KEY`（以及如需的 `NAV_HISTORY_DB`），不要将密钥写进代码。

---

## 常见操作

- **新增搜索别名 / 预设主题**：编辑 `qdii_portfolio/data/tag_aliases.py`（`TAG_ALIASES`、`PRESET_THEMES`）。
- **更新基准**：编辑 `qdii_portfolio/data/benchmarks.py`。
- **新增标签**：在 `tag_taxonomy` 插入；在 `holding_tag_map` 打标后执行 `aggregate`。

---

## 许可与维护

本项目为内部使用的 QDII 配置与展示工具。维护说明见仓库内 `MAINTENANCE.md`（如有）。
