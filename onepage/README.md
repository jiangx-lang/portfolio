# MRF 基金 PDF 存放目录

本目录存放 **MRF（北上互认基金，968xxx）** 各基金公司的单页/月报 PDF。  
项目内已有**按基金公司区分的扫描程序**，以及**汇总展示/优化**流程；持仓可选择性写入 **Supabase `mrf_holdings`** 或导出 CSV 作为「汇总表格/数据库」。

---

## 1. PDF 放在哪

- **路径**：`D:\portoflio for mrf\onepage`（即本目录）
- 将 PDF 放入此目录后，下方各扫描脚本会按**文件名关键字**自动选用对应解析器。

---

## 2. 各基金公司对应的扫描程序与解析器

| 基金公司 | 文件名关键字 | 解析器模块 | 扫描/入口脚本 |
|---------|--------------|------------|----------------|
| 摩根 JPM | 摩根、jpm、jpmorgan | `parsers/jpm_parser.py` | `run_all_jpm_json.py`、`main.py` |
| 瑞士百达 Pictet | 百达、pictet | `parsers/pictet_parser.py` | `scan_pictet.py` |
| 东亚联丰 BEA | 东亚、联丰 | `parsers/bea_parser.py` | `scan_bea.py`、`test_bea.py` |
| 东方汇理 Amundi | 东方汇理、amundi | `parsers/amundi_parser.py` | `scan_amundi.py`、`test_amundi.py` |
| 惠理 ValuePartners | 惠理、value、valuepartners | `parsers/valuepartners_parser.py` | `scan_valuepartners.py` |
| 中银 BOCI | 中银、中銀、boci | `parsers/boci_parser.py` | `scan_boci.py`、`debug_boci_page0.py` |

**统一入口**（不区分公司，按文件名自动选解析器）：

- **`fund_factory.py`**：`get_parser_for_file(path)`、`parse_fund_pdf(path)`  
- **`scan_all_detail.py`**：扫描本目录下所有可解析 PDF，在终端**详细打印**每家基金的：投资组合分析、十大持仓、十大债券持仓、地区/行业分布等（即「汇总展示」）。
- **`run_optimizer.py`**：扫描本目录 PDF → 映射引擎(13 维) → 优化器 → 输出基金权重与投资计划（使用解析结果做资产配置，不写库）。

---

## 3. 汇总表格 / 数据库

- **当前「汇总」形式**  
  - **终端汇总**：运行 `scan_all_detail.py` 得到所有可解析 PDF 的抽取结果（无持久化）。  
  - **优化用**：`run_optimizer.py` 在内存中使用解析结果做配置优化，不写数据库。

- **持久化汇总（可选）**  
  - **脚本 `mrf_scan_to_holdings.py`**（项目根目录）：扫描 onepage 下全部可解析 PDF，将十大持仓（股+债）导出为 **CSV 汇总表** `mrf_holdings_scan.csv`；加参数 `--supabase` 可同时写入 **Supabase 表 `mrf_holdings`**（需配置环境变量）。  
  - **Supabase 表 `mrf_holdings`**：用于 968 基金 Top 持仓；建表 SQL 见项目根目录 `supabase_mrf_holdings.sql`。

- **MRF 基金列表/池**  
  - **Supabase 表 `mrf_funds`**：基金名单、品牌、股债现比例、费率等；由 `scripts/load_mrf_pool_from_supabase.py` 供 `app.py` 使用。

---

## 4. 常用命令（在项目根目录执行）

```bash
# 扫描本目录全部 PDF 并详细打印（汇总展示）
py scan_all_detail.py

# 仅摩根 PDF → JSON
py run_all_jpm_json.py

# 用本目录 PDF 做资产配置优化（汇总进优化器）
py run_optimizer.py
```

---

## 5. 当前 onepage 内 PDF 示例

- 东亚联丰：环球股票基金、亚洲债券及货币基金 每月基金报告  
- 东方汇理：香港组合 – 灵活配置增长/均衡/平稳  
- 中银香港：环球股票基金、香港股票基金  
- 惠理：价值基金、高息股票基金 P 类 每月基金报告  
- 摩根：亚洲总收益、亚洲股息、国际债、太平洋科技、太平洋证券  
- 瑞士百达：策略收益基金-HM 人民币 每月基金报告  

确保新放入的 PDF 文件名包含上表所列「文件名关键字」，即可被对应解析器识别并参与 `scan_all_detail` / `run_optimizer` 的汇总。
