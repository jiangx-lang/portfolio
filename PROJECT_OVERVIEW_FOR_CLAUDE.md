# 项目架构说明（供 Claude AI 阅读）

本文档描述「锦城轮动 / 组合与基金持仓」相关系统的整体架构、技术栈、数据流与待办事项。

---

## 1. 项目总览

### 系统划分

| 系统名称 | 用途 | 部署位置 | 访问地址 |
|---------|------|----------|----------|
| **锦城轮动主应用（MRF + 配置优化）** | 宏观资产配置优化、MRF 基金池、精选/模型/补充 Portfolio、每日报告、市场播客、访客雷达；内嵌 QDII 入口 | 腾讯云 / Streamlit Cloud / 本地 | 腾讯云: `http://43.161.234.75:8501`；Streamlit Cloud 为所配置域名；本地: `http://localhost:8501` |
| **锦城轮动 QDII 系统** | 主题基金搜索、组合构建器、历史业绩曲线、未命中记录、管理后台；已合并进主 app 同一端口，通过首页入口进入 | 与主应用同机/同端口 | 同上，进入后选「锦城轮动系统 QDII」 |
| **静态文件服务** | 提供市场 PDF/播客等静态文件 | 腾讯云同机 | `http://43.161.234.75:8504`（FILE_SERVER_BASE_URL） |
| **Next.js 持仓看板（mf-holdings-dashboard）** | Portfolio 总览、QD 基金列表与 Top 10 持仓、MRF 列表与持仓、AI Signals、Risk、个股/期权等；与 Streamlit 数据共享 | 本地 / 可部署 Vercel 等 | 本地: `http://localhost:3000` |

说明：QDII 原计划 8502 端口，当前已合并到主 app，不再单独 8502。

---

## 2. 各系统技术栈

### 2.1 锦城轮动主应用（app.py）

- **语言**: Python 3
- **框架**: Streamlit
- **数据库**: 无直接 DB（读 Supabase、可选读本地 SQLite fund_tagging.db 用于 QDII 模块）
- **主要依赖**: streamlit, pandas, numpy, scipy, plotly, requests, supabase（可选）, pathlib, zoneinfo

### 2.2 QDII 子系统（qdii_portfolio/）

- **语言**: Python 3
- **框架**: Streamlit（通过主 app 挂载）
- **数据库**: SQLite `fund_tagging.db`（标签与持仓）；净值可选 Supabase 或本地 `nav_history.db`
- **主要依赖**: 同主应用 + fund_tagging（自研模块）

### 2.3 基金标签与持仓（fund_tagging/）

- **语言**: Python 3
- **数据库**: SQLite（schema 见 fund_tagging/schema.sql）
- **主要依赖**: sqlite3 标准库、pydantic（若用）

### 2.4 Next.js 持仓看板（mf-holdings-dashboard/）

- **语言**: TypeScript
- **框架**: Next.js 14（App Router）
- **数据库**: 读 SQLite `qdii_portfolio/fund_tagging.db`（better-sqlite3）、读 Supabase（mrf_funds, mrf_holdings, nav_history, fund_list）
- **主要依赖**: next, react, @supabase/supabase-js, better-sqlite3, recharts, chart.js, react-chartjs-2, groq-sdk, tailwindcss, zustand

---

## 3. 文件结构（.py / .ts / .tsx，已排除 node_modules、.next、__pycache__）

```
add_code_column.py
app.py
check.py
check_qd_codes.py
check_qdur003.py
check_qdur048.py
check_qdur159.py
check_qdut001.py
check_scan_result.py
check_segments.py
check2.py
check3.py
classify_review.py
cloud_update_nav.py
cloud_update_nav_v2.py
compare_qd_official.py
config.py
db_manager.py
debug_boci_page0.py
diagnose_review.py
diagnose_review_from_logs.py
dual_pie_page.py
export_top_holdings.py
fix_qdur003_data.py
fund_factory.py
fund_tagging/__init__.py
fund_tagging/aggregation.py
fund_tagging/bond_credit_enrich.py
fund_tagging/bond_halo_filter.py
fund_tagging/db.py
fund_tagging/demo_search.py
fund_tagging/holding_tagger.py
fund_tagging/ingestion.py
fund_tagging/run.py
fund_tagging/search.py
fund_tagging/seed_holding_library.py
fund_tagging/seed_tags.py
fund_tagging/seed_taxonomy_47.py
fund_tagging/standardizer.py
fund_tagging/top500_untagged.py
holdings_route.ts
import_holdings.py
inspect_db.py
load_mrf_pool_from_supabase.py
main.py
mapping_engine.py
mf-holdings-dashboard/next-env.d.ts
mf-holdings-dashboard/src/app/api/analyze/route.ts
mf-holdings-dashboard/src/app/api/fund/[code]/route.ts
mf-holdings-dashboard/src/app/api/holdings/route.ts
mf-holdings-dashboard/src/app/api/iv/[ticker]/route.ts
mf-holdings-dashboard/src/app/api/mrf/funds/route.ts
mf-holdings-dashboard/src/app/api/mrf/holdings/[code]/route.ts
mf-holdings-dashboard/src/app/api/nav/[isin]/route.ts
mf-holdings-dashboard/src/app/api/options/[ticker]/route.ts
mf-holdings-dashboard/src/app/api/qd/funds/route.ts
mf-holdings-dashboard/src/app/api/quote/[ticker]/route.ts
mf-holdings-dashboard/src/app/layout.tsx
mf-holdings-dashboard/src/app/mrf/error.tsx
mf-holdings-dashboard/src/app/mrf/page.tsx
mf-holdings-dashboard/src/app/page.tsx
mf-holdings-dashboard/src/app/qd/page.tsx
mf-holdings-dashboard/src/app/risk/page.tsx
mf-holdings-dashboard/src/app/signals/page.tsx
mf-holdings-dashboard/src/app/stock/[ticker]/page.tsx
mf-holdings-dashboard/src/components/AISignalBox.tsx
mf-holdings-dashboard/src/components/HoldingsTable.tsx
mf-holdings-dashboard/src/components/IVGauge.tsx
mf-holdings-dashboard/src/components/MetricCard.tsx
mf-holdings-dashboard/src/components/MrfPageInner.tsx
mf-holdings-dashboard/src/components/NavChart.tsx
mf-holdings-dashboard/src/components/OptionsChain.tsx
mf-holdings-dashboard/src/components/PayoffDiagram.tsx
mf-holdings-dashboard/src/components/QdiiFundView.tsx
mf-holdings-dashboard/src/components/SectorChart.tsx
mf-holdings-dashboard/src/components/StockDetailClient.tsx
mf-holdings-dashboard/src/components/StrategyCards.tsx
mf-holdings-dashboard/src/components/UpgradeBanner.tsx
mf-holdings-dashboard/src/components/YtdBarChart.tsx
mf-holdings-dashboard/src/lib/blackScholes.ts
mf-holdings-dashboard/src/lib/claude.ts
mf-holdings-dashboard/src/lib/constants.ts
mf-holdings-dashboard/src/lib/groq.ts
mf-holdings-dashboard/src/lib/mockData.ts
mf-holdings-dashboard/src/lib/optionsMock.ts
mf-holdings-dashboard/src/lib/publiccom.ts
mf-holdings-dashboard/src/lib/strategies.ts
mf-holdings-dashboard/src/lib/supabase.ts
mf-holdings-dashboard/src/lib/utils.ts
mf-holdings-dashboard/src/lib/yahoo.ts
mf-holdings-dashboard/src/types/index.ts
mf-holdings-dashboard/tailwind.config.ts
migrate_to_your_taxonomy.py
mrf_page.tsx
mrf_route.ts
mrf_scan_to_holdings.py
nav_chart.py
nav_route.ts
NavChart.tsx
optimizer.py
parsers/__init__.py
parsers/amundi_parser.py
parsers/base_parser.py
parsers/bea_parser.py
parsers/boci_parser.py
parsers/jpm_parser.py
parsers/pictet_parser.py
parsers/schemas.py
parsers/valuepartners_parser.py
parsers/word_utils.py
pdf_parser.py
qdii_portfolio/app.py
qdii_portfolio/check_supabase_env.py
qdii_portfolio/data/__init__.py
qdii_portfolio/data/benchmarks.py
qdii_portfolio/data/fund_meta_builder.py
qdii_portfolio/data/miss_store.py
qdii_portfolio/data/tag_aliases.py
qdii_portfolio/pages/__init__.py
qdii_portfolio/pages/admin.py
qdii_portfolio/pages/fund_detail.py
qdii_portfolio/pages/miss_log.py
qdii_portfolio/pages/nav_chart.py
qdii_portfolio/pages/portfolio_builder.py
qdii_portfolio/pages/theme_search.py
qdii_portfolio/scripts/load_mrf_pool_from_supabase.py
qdii_portfolio/show_data.py
qdii_portfolio/show_schema.py
restore_review_status.py
run_all_jpm_json.py
run_optimizer.py
sc_fund_audit_tool.py
sc_fund_parser.py
sc_fund_parser_qwen.py
sc_fund_parser_qwen_v2.py
scan_all_detail.py
scan_amundi.py
scan_bea.py
scan_boci.py
scan_pictet.py
scan_valuepartners.py
portfolio_reports_enrich.py
portfolio_reports_migrate.py
scripts/check_fund_tagging_db.py
scripts/download_mrf_nav_akshare.py
scripts/list_968_funds.py
scripts/load_mrf_pool_from_supabase.py
scripts/sc_fund_scraper.py
scripts/sc_fund_scraper_simple.py
scripts/sc_fund_scraper_v2.py
show_codes.py
supabase.ts
supabase_sync.py
test_amundi.py
test_bea.py
tests/test_bond_metrics.py
update_primary_code.py
wmp_csv.py
wmp_db.py
wmp_scraper.py
输出/fund_tagging/...（同上结构部分文件）
```

---

## 4. 数据库结构

### 4.1 Supabase 表

| 表名 | 用途 | 主要字段 |
|------|------|----------|
| **nav_history** | QD 基金历史净值 | isin, ccy, nav_date, nav, source；主键 (isin, ccy, nav_date) |
| **fund_list** | 基金代码与 ISIN 映射，供净值查询 | code, isin, ccy, bbg, nav_source；主键 (isin, ccy) |
| **mrf_funds** | MRF 基金池（名称、品牌、股债现比例、费率） | fund_name (PK), brand, equity_pct, fixed_income_pct, cash_pct, fee_rate, created_at, updated_at；可扩展 sc_product_code 用于 968 代码 |
| **mrf_holdings** | MRF（968）基金 Top 持仓，可来自 onepage 扫描或手动维护 | id, sc_product_code, fund_name, rank, holding_name, holding_type, weight_pct, as_of_date, created_at |
| **file_clicks**（若已建） | 文件点击统计 | 见 supabase_admin_tables.sql |
| **page_entries**（若已建） | 页面访问记录 | 见 supabase_admin_tables.sql |

RLS：上述业务表均为 SELECT 允许匿名（anon key 可读），供 Streamlit / Next.js 使用。

### 4.2 SQLite fund_tagging.db（QDII 标签与持仓）

路径：`qdii_portfolio/fund_tagging.db`（或由 config.FUND_TAGGING_DB 指定）。

| 表名 | 用途 | 主要字段 |
|------|------|----------|
| **tag_taxonomy** | 标签分类（region/sector/theme/style/custom/asset_class） | tag_id, tag_name, category, parent_tag_id, aliases(JSON), is_active |
| **holding_tag_map** | 持仓名称 → 标签映射 | holding_name_std, tag_id, confidence_score, source |
| **fund_holding_exposure** | 基金 × 持仓 × 日期 敞口 | fund_id, fund_name_cn, holding_name_std, holding_name_raw, holding_type, weight_pct, rank, as_of_date, **sc_product_code**, **primary_code**（后两列为后续添加） |
| **fund_tag_map** | 基金 → 标签聚合结果（物化） | fund_id, tag_id, aggregated_score, explanation(JSON), calculated_at |

数据量（参考）：fund_holding_exposure 约 1400+ 条（来自 top_holdings_detail.csv 导入）；基金按 (fund_id, fund_name_cn) 去重约 141 只 QD；tag_taxonomy / holding_tag_map 视打标与种子数据而定。

### 4.3 SQLite nav_history.db（本地净值）

路径：由 config.NAV_HISTORY_DB 或环境变量指定，如 `data/nav_history.db` 或腾讯云 `/root/data/nav_history.db`。

| 表名 | 用途 | 主要字段 |
|------|------|----------|
| **nav_history** | 本地净值历史 | isin, ccy, nav_date, nav, source |
| **fund_list** | 基金列表（code, isin, ccy 等） | code, isin, ccy, bbg, nav_source, yahoo_symbol（若存在） |

数据通过 cloud_update_nav_v2.py / cloud_update_nav.py 写入，并通过 supabase_sync.py 增量同步到 Supabase。

---

## 5. 数据流

### 5.1 数据来源

- **QD 基金 Top 10 Holdings**  
  - 来源：SC 披露 PDF（sc_funds_pdf_v2/ 等）→ sc_fund_parser_qwen_v2.py 解析 → sc_funds.db；或已有 CSV（如 top_holdings_detail.csv）→ import_holdings.py 导入 fund_holding_exposure。  
  - add_code_column.py / update_primary_code.py 为 fund_holding_exposure 写入 sc_product_code、primary_code。

- **QD 净值**  
  - 来源：yfinance / 其他数据源（cloud_update_nav*.py）→ nav_history.db → supabase_sync.py → Supabase nav_history。

- **MRF 基金池**  
  - 来源：app.py 硬编码 MRF_POOL；或 Supabase mrf_funds 表；scripts/load_mrf_pool_from_supabase.py 供 app 与 Next.js 使用。

- **MRF Top 10 Holdings**  
  - 来源：Supabase mrf_holdings（手动或 mrf_scan_to_holdings.py 从 onepage PDF 扫描写入）；或暂无数据时 Next.js 显示「请先配置产品代码」等提示。

- **onepage MRF PDF**  
  - 路径：`onepage/`；parsers（amundi/bea/boci/jpm/pictet/valuepartners）按文件名识别并解析；scan_all_detail.py 汇总展示；mrf_scan_to_holdings.py 可导出 CSV 或写入 mrf_holdings。

### 5.2 数据到前端的流转

- **Streamlit 主 app**：读 Supabase（mrf_funds）、本地 fund_tagging.db（QDII 模块）、市场文件来自 MARKET_FILES_BASE（8504 静态服务）。
- **Next.js**：  
  - QD 列表：GET /api/qd/funds → 读 fund_tagging.db fund_holding_exposure 聚合。  
  - QD 持仓：GET /api/mrf/holdings/[code] → code 非 968 时读 fund_holding_exposure（sc_product_code / primary_code 匹配）。  
  - MRF 列表：GET /api/mrf/funds → Supabase mrf_funds，失败则用内置 MRF_MOCK。  
  - MRF 持仓：GET /api/mrf/holdings/[code] → code 为 968 开头时先查 Supabase mrf_holdings，无则再查 fund_holding_exposure（兼容历史）。

---

## 6. QD 系统详情

### 6.1 页面与功能（Streamlit 内嵌）

- **主题基金搜索**：按标签/主题检索 QD 基金。  
- **组合构建器**：基于 fund_tagging 与净值构建组合。  
- **历史业绩曲线**：基金净值走势与年度收益。  
- **未命中记录**：记录查询未命中等。  
- **管理后台**：标签与数据管理。

入口：首页选「锦城轮动系统 QDII」→ 选设备（手机/电脑）→ 侧边栏或下拉选上述功能。

### 6.2 基金代码格式

- **QDURxxxYYY** / **QDUTxxxYYY**：xxx 为 3 位数字，YYY 为货币（如 USD, EUR, CNY, HKD, SGD, AUD, GBP）。  
- 示例：QDUR128USD、QDUT001EUR。  
- primary_code：去掉货币后缀，如 QDUR128、QDUT001，用于 API 查询时兼容。

### 6.3 Top 10 Holdings 数据情况

- **来源**：top_holdings_detail.csv 导入 fund_holding_exposure，并写入 sc_product_code、primary_code。  
- **覆盖**：约 141 只基金（按 fund_id 去重）、约 224 个产品代码（份额级）；与官方表对比约 57 个份额代码缺失（见 qd_missing_codes.txt / compare_qd_official.py）。  
- **Next.js**：/qd 列表来自 /api/qd/funds；点击行请求 /api/mrf/holdings/[code] 展示 Top 10。

---

## 7. MRF 系统详情

### 7.1 页面与功能

- **Streamlit**：主 app 内「精选 Portfolio」「Model Portfolio」「补充 Portfolio」等 Tab，使用 MRF_POOL 做资产配置与费率统计；自定义 Portfolio 构建器可选 MRF 基金与权重。  
- **Next.js**：/mrf 页展示 MRF 基金列表（来自 /api/mrf/funds），选择基金后按 sc_product_code（968 或 display_name）请求 /api/mrf/holdings/[code] 展示 Top 10。

### 7.2 基金代码格式

- **968XXX**：香港互认基金代码（如 968001）。  
- 在 Supabase mrf_funds 可增加 **sc_product_code** 字段，与 968 或内部代码对应，便于与 mrf_holdings 关联。

### 7.3 MRF_POOL 中基金（16 只，与 mrf_funds.sql 种子一致）

东方汇理香港组合-灵活配置增长/均衡/平稳、东亚联丰环球股票基金、东亚联丰亚洲债券及货币基金、惠理高息股票基金、惠理价值基金、摩根国际债/太平洋科技/太平洋证券/亚洲股息/亚洲总收益、瑞士百达策略收益基金、中银香港环球股票基金、中银香港香港股票基金、施罗德亚洲高息股债基金M类别(人民币派息)。  
排除池：东亚联丰亚洲债券及货币基金（EXCLUDED_FUNDS）。

### 7.4 MRF Top 10 Holdings 数据情况

- **Supabase mrf_holdings**：若已录入或通过 mrf_scan_to_holdings.py 写入，则 Next.js/API 可展示；否则 MRF 页需配置 sc_product_code 并录入持仓。  
- **onepage 扫描**：mrf_scan_to_holdings.py 可把解析结果导出 CSV 或写入 mrf_holdings（需 SUPABASE_* 配置）。

---

## 8. Next.js Dashboard（mf-holdings-dashboard）详情

### 8.1 文件结构（主要）

```
mf-holdings-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Portfolio 首页
│   │   ├── qd/page.tsx           # QD 基金列表 + 持仓
│   │   ├── mrf/page.tsx          # MRF 列表 + 持仓
│   │   ├── signals/page.tsx     # AI Signals
│   │   ├── risk/page.tsx        # Risk
│   │   ├── stock/[ticker]/page.tsx
│   │   ├── api/
│   │   │   ├── qd/funds/route.ts
│   │   │   ├── mrf/funds/route.ts
│   │   │   ├── mrf/holdings/[code]/route.ts  # QD + MRF 共用
│   │   │   ├── nav/[isin]/route.ts
│   │   │   ├── analyze/route.ts
│   │   │   ├── quote/[ticker]/route.ts
│   │   │   ├── iv/[ticker]/route.ts
│   │   │   ├── options/[ticker]/route.ts
│   │   │   └── ...
│   │   └── mrf/error.tsx
│   ├── components/
│   │   ├── HoldingsTable.tsx
│   │   ├── QdiiFundView.tsx
│   │   ├── MrfPageInner.tsx
│   │   ├── NavChart.tsx
│   │   ├── SectorChart.tsx
│   │   ├── YtdBarChart.tsx
│   │   ├── AISignalBox.tsx
│   │   ├── IVGauge.tsx
│   │   ├── OptionsChain.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── publiccom.ts
│   │   ├── yahoo.ts
│   │   ├── groq.ts
│   │   ├── claude.ts
│   │   └── ...
│   └── types/index.ts
├── tailwind.config.ts
└── package.json
```

### 8.2 已实现功能

- **Portfolio 首页**：汇总卡片（AUM、集中度、P/E、Beta）、Top 10 Holdings 表格、行业与 YTD 图表；数据来自 publiccom 或 mock。  
- **QD 基金**：列表（基金名、代码、持仓条数、截至日期），点击行展开 Top 10（来自 fund_tagging.db fund_holding_exposure）。  
- **MRF**：列表（来自 Supabase mrf_funds 或 MRF_MOCK），按 sc_product_code 请求持仓（Supabase mrf_holdings 或回退 SQLite）。  
- **AI Signals**：Groq/Claude 分析等。  
- **Risk**：风险相关展示。  
- **个股/期权**：股票详情、IV、期权链等（部分依赖 Yahoo/公开 API）。

### 8.3 与老系统关系

- **数据共享**：  
  - QD：共用一个 fund_tagging.db（fund_holding_exposure）。  
  - MRF：共用 Supabase mrf_funds、mrf_holdings；app.py 的 MRF_POOL 可由 load_mrf_pool_from_supabase 从 mrf_funds 加载。  
  - 净值：Supabase nav_history / fund_list 与 Streamlit 侧同步使用。  
- **独立部分**：Next.js 自带路由与 UI，不依赖 Streamlit 渲染；可单独部署（如 Vercel），但需能访问 SQLite 文件或仅用 Supabase/API。

---

## 9. 当前未完成 / 已知问题

- **QD 缺失代码**：官方约 180 只产品（按份额约 277 个代码），当前 CSV/DB 约 141 只基金、224 个代码；57 个份额代码缺失（见 compare_qd_official.py、qd_missing_codes.txt）。  
- **MRF 持仓**：部分 MRF 尚未在 mrf_holdings 中配置或扫描录入；Next.js MRF 页依赖 sc_product_code，未配置时需提示或从 onepage 扫描导入。  
- **mrf_funds.sc_product_code**：若 Supabase 表尚未加该列，需执行 ALTER 并维护 968 与 display_name 对应关系，以便 MRF 持仓查询一致。  
- **Next.js 读 SQLite**：部署到无本地文件的环境（如 Vercel）时，需改为通过 API 或 Supabase 提供 QD 列表/持仓，或仅保留 MRF + Portfolio 等不依赖 SQLite 的功能。  
- **Streamlit 与 Next.js 访问地址**：需在文档或配置中明确生产环境 URL（如 43.161.234.75:8501 与 Next 部署域名）。

---

## 10. 下一步计划（建议优先级）

1. **补全 QD 缺失数据**：根据 qd_missing_codes.txt 或官方表，补充缺失的 57 个份额代码对应基金的持仓（或确认哪些已终止/不维护），并更新 top_holdings_detail.csv 与 fund_holding_exposure。  
2. **MRF 持仓闭环**：为 mrf_funds 维护 sc_product_code（968 或内部代码）；对已上架 MRF 通过 onepage 扫描或手动录入 mrf_holdings，使 Next.js MRF 页与 API 稳定展示 Top 10。  
3. **Next.js 生产部署与数据源**：确定 Dashboard 生产部署方式；若无法直接读 SQLite，则增加后端 API（或 Supabase 表）提供 QD 列表与持仓，保证 /qd 与 /api/mrf/holdings/[code] 在无本地 DB 环境下可用。

---

*文档版本：基于当前代码与配置整理，供 Claude 理解项目全貌与接续开发。*
