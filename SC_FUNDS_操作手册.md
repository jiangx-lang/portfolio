# SC QDII 基金数据库 · 操作手册

> 数据库：`sc_funds.db` · 解析器：`sc_fund_parser_qwen_v2.py` · 审核工具：`sc_fund_audit_tool.py`

---

## 一、每月更新流程（标准步骤）

```bash
# 1. 下载新 PDF（爬虫）
py sc_fund_scraper_qwen.py --dir ./sc_funds_pdf_v2

# 2. 解析入库
py sc_fund_parser_qwen_v2.py --db ./sc_funds.db --dir ./sc_funds_pdf_v2

# 3. 看诊断报告
py sc_fund_audit_tool.py --db ./sc_funds.db --diagnose

# 4. 自动确认低风险
py sc_fund_audit_tool.py --db ./sc_funds.db --auto --dry-run   # 先预览
py sc_fund_audit_tool.py --db ./sc_funds.db --auto             # 正式执行

# 5. 剩余手动处理
py sc_fund_audit_tool.py --db ./sc_funds.db --interactive

# 6. 高风险（列错位/名称缺失）重新解析
py sc_fund_parser_qwen_v2.py --file <文件名> --force
```

---

## 二、status 含义

| status | 含义 | 操作 |
|--------|------|------|
| 0 | 待处理（从未解析成功） | `--force` 重解析 |
| 1 | 正常入库 ✅ | 无需操作 |
| 2 | 需人工确认 ⚠️ | `--auto` / `--interactive` / `--confirm-id` |

---

## 三、自动确认规则（`--auto` 会处理的）

| 规则 | 说明 |
|------|------|
| 只有 `isin_codes` 为 null | 代码找不到，不影响核心数据 |
| 只有 `bloomberg_codes` 为 null | 同上 |
| 只有 `nav` 不确定 | 净值份额不明确，其他数据正常 |
| 只有 `data_as_of` 不确定 | 日期轻微歧义 |
| 权重偏差 ±5% 以内 | 四舍五入导致，正常现象 |
| isin + bloomberg 同时为 null | 两个代码都找不到 |
| 仅 ret_3m==ret_1y 警告 | 列对齐轻微问题，无其他错误 |
| 仅 ret_ytd 超出范围 | 黄金/矿业等基金正常波动 |

---

## 四、高风险情况（不自动确认，需人工）

| 触发条件 | 建议操作 |
|----------|----------|
| `fund_name_cn` 为 null | `--force` 重解析 |
| `sc_risk_rating` 为 null | `--force` 重解析 |
| `mgmt_fee_pct` 缺失 | 查官网补录或重解析 |
| `investment_objective` 为 null | 可接受则 `--confirm-id`，否则重解析 |
| ABORT（权重 >115% 或 <85%） | `--force` 重解析 |

---

## 五、常用命令速查

```bash
# 查看数据库状态
py sc_fund_audit_tool.py --db ./sc_funds.db --diagnose

# 查看摘要（行数统计）
py sc_fund_parser_qwen_v2.py --db ./sc_funds.db --summary

# 按 ID 确认（不询问）
py sc_fund_audit_tool.py --db ./sc_funds.db --confirm-id 44,65,88

# 批量确认含某关键词的记录
py sc_fund_audit_tool.py --db ./sc_funds.db --batch-confirm "isin_codes"

# 把记录退回重解析（改为 status=0）
py sc_fund_audit_tool.py --db ./sc_funds.db --reject-id 7,8,61,140

# 导出待审核记录到 Excel
py sc_fund_audit_tool.py --db ./sc_funds.db --export --output audit.csv

# 强制重新解析单个文件
py sc_fund_parser_qwen_v2.py --db ./sc_funds.db --file cn-fs-qdur048.pdf --force

# 查看待确认新字段
py sc_fund_parser_qwen_v2.py --review

# 切换模型（省钱用 plus，正式用 max）
py sc_fund_parser_qwen_v2.py --dir ./pdfs --model qwen-vl-plus
```

---

## 六、数据库表速查

| 表 | 用途 | 关键字段 |
|----|------|----------|
| `funds` | 基金主表 | `status`, `sc_risk_rating`, `fund_aum_usd`, `mgmt_fee_pct` |
| `fund_performance` | 业绩净值 | `ret_1y/3y/5y`, `nav`, `as_of_date` |
| `dividend_history` | 派息记录 | `annualized_yield_pct`, `ex_div_date` |
| `top_holdings` | 十大持仓 | `holding_name`, `weight_pct`, `rank` |
| `regional_allocation` | 地区配置 | `region`, `weight_pct` |
| `sector_allocation` | 行业配置 | `sector`, `weight_pct` |
| `credit_rating_allocation` | 信用评级 | `rating`, `weight_pct` |
| `asset_class_allocation` | 资产类别 | `asset_class`, `weight_pct` |
| `parsing_logs` | 解析日志 | `uncertain_fields`, `validation_errors` |

---

## 七、常用 SQL 查询

```sql
-- 当前状态分布
SELECT status, COUNT(*) FROM funds GROUP BY status;

-- 查看所有待审核
SELECT id, fund_name_cn, review_reason FROM funds WHERE status=2;

-- 某只基金的最新业绩
SELECT share_class, ret_ytd, ret_1y, ret_3y, nav
FROM fund_performance
WHERE fund_id = (SELECT id FROM funds WHERE sc_product_codes LIKE '%QDUR048%')
ORDER BY as_of_date DESC LIMIT 5;

-- 按风险等级统计 AUM
SELECT sc_risk_rating, COUNT(*) as 基金数,
       ROUND(SUM(fund_aum_usd)/1000, 1) as 总AUM_十亿美元
FROM funds WHERE status=1
GROUP BY sc_risk_rating ORDER BY 总AUM_十亿美元 DESC;

-- 最高派息率的基金
SELECT f.fund_name_cn, d.sc_product_code,
       d.annualized_yield_pct, d.ex_div_date
FROM dividend_history d
JOIN funds f ON f.id = d.fund_id
WHERE d.annualized_yield_pct IS NOT NULL
ORDER BY d.annualized_yield_pct DESC LIMIT 10;

-- 重叠持仓（多只基金都持有的股票）
SELECT holding_name, COUNT(DISTINCT fund_id) as 基金数,
       ROUND(AVG(weight_pct),2) as 平均权重
FROM top_holdings
WHERE holding_type = 'equity'
GROUP BY holding_name HAVING 基金数 >= 3
ORDER BY 基金数 DESC;

-- 高风险待审核（需重解析的）
SELECT f.id, f.source_file, f.review_reason
FROM funds f
WHERE f.status = 2
  AND (f.review_reason LIKE '%fund_name_cn%'
    OR f.review_reason LIKE '%sc_risk_rating%'
    OR f.review_reason LIKE '%ABORT%');
```

---

## 八、文件结构

```
项目目录/
├── sc_funds.db                    ← 数据库
├── sc_fund_parser_qwen_v2.py      ← 主解析器
├── sc_fund_audit_tool.py          ← 审核工具
├── sc_fund_scraper_qwen.py        ← PDF 爬虫
├── sc_fund_filter.py              ← PDF 过滤工具
├── run_audit.bat                  ← 批量审核脚本
└── sc_funds_pdf_v2/               ← PDF 存放目录
```

---

*最后更新：2026-03-15*
