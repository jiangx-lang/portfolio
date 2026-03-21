# 中银香港两只 MRF「没有持仓 / 没有深度分析数据」说明

## 原因（代码与库核对结论）

1. **前端列表**里的基金元数据（股票 95%、费率等）来自 **`mrf_funds`** 或本地 `MRF_MOCK`，**不依赖** PDF。
2. **Top10 持仓、持仓深度分析**依赖 **Supabase 表 `mrf_holdings`**。  
   若库中**没有**「中银香港环球股票基金」「中银香港香港股票基金」对应行，展开后就会显示「暂无底层持仓数据」或类似提示，**不会出现**加权 PE/PB 卡片。
3. 仓库内**没有**预置这两只基金的 `mrf_holdings` 种子 SQL（与施罗德/摩根部分脚本不同），需要你自己 **PDF 解析入库** 或 **手工导入**。
4. **产品代码对齐**（已修复）：  
   - `scripts/mrf_akshare_mapping.csv`：**968031** = 环球股票，**968030** = 香港股票。  
   - 请在 Supabase 对 `mrf_funds` 执行 `mrf_funds_sc_product_code_updates.sql`（中银两行已改为 968031/968030）。  
   - `mrf_scan_to_holdings.py` 写入 `mrf_holdings` 时会用该映射填 **数字代码**，与按代码查询的 API 一致。

## 繁体 / 简体统一（强烈建议）

若 `mrf_holdings.fund_name` 为繁体（如「中銀香港環球股票基金」），而 `mrf_funds` 为简体，会导致按 `968031` 或基金名查持仓失败。请在 Supabase **SQL Editor** 执行：

- **`scripts/mrf_supabase_normalize_zh_cn.sql`**（将 `mrf_holdings` / `mrf_funds` 相关中银基金名与港股 Top10 持仓名改为**简体中文**，与前端、种子数据一致）

执行后无需再手改简繁混用。

## 你在 Supabase 里先跑诊断

将 `scripts/diagnose_mrf_boc_holdings.sql` 复制到 **SQL Editor** 执行，看：
- `mrf_funds` 里 `sc_product_code` 是否为 **968031 / 968030**；
- `mrf_holdings` 里是否有 `COUNT(*) > 0`。

## 有 PDF 时：推荐入库流程

1. 把中银基金的**月报/年报 PDF**放进项目 **`onepage/`**（文件名需含「中银」等关键字，见 `parsers/boci_parser.py` / `fund_factory.py`）。
2. 配置环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 或 `SUPABASE_KEY`（与 `mrf_scan_to_holdings.py` 一致）。
3. 在项目根目录执行：
   ```bash
   py mrf_scan_to_holdings.py --supabase
   ```
4. 再执行一次 **`mrf_funds_sc_product_code_updates.sql`**（或只 UPDATE 中银两行），保证 **`mrf_funds.sc_product_code`** 与 **`mrf_holdings.sc_product_code`** 均为 **968031 / 968030**。
5. 刷新 Next `/mrf`，重新展开基金 → 应出现 Top10 与「持仓深度分析」。

## 没有 PDF / 解析失败

- 可**重新上传**清晰、含「十大持仓」表格的 PDF 再跑扫描。  
- 或按 `supabase_mrf_holdings.sql` 表结构**手工 INSERT** 若干行（`fund_name`、`sc_product_code`、`rank`、`holding_name`、`holding_type`、`weight_pct`、`as_of_date`）。

## 与截图里「AI 摘要」的关系

页面上的 **「深度分析 →」/ AI 摘要** 若来自**另一路**（例如仅基金画像、PDF 文本），**不会**自动补全 `mrf_holdings`；**数值型 Top10 分析**仍以 **`mrf_holdings` + Python `fetch_market_data`** 为准。
