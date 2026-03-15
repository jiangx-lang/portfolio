# Fund Tagging (Bottom-Up) — 复制到输出

The full system is built and tested. 6 modules, clean separation of concerns.

## 文件职责

| 文件 | 职责 |
|------|------|
| **schema.sql** | 4张表 + 索引，SQLite/PostgreSQL两用 |
| **db.py** | 唯一的数据库连接管理，所有模块从这里取 `get_connection()` |
| **standardizer.py** | 持仓名称标准化（中英文合并、去法律后缀、去行业括号） |
| **ingestion.py** | CSV解析 → fund_holding_exposure，自动去重合并权重 |
| **holding_tagger.py** | 三个后端：规则/LLM占位/手动覆盖，合并逻辑 **manual > rule > llm** |
| **aggregation.py** | 核心公式 score = SUM(weight × confidence)，生成 explanation JSON |
| **search.py** | FundSearchEngine.search(criteria_dict)，AND多条件，可解释返回 |
| **seed_tags.py** | 48个标签分类 + 60条示例持仓映射 |
| **run.py** | CLI一键跑完整流程 |

## 实测结果

- **ingest** → 1401行，865个唯一持仓
- **tag** → 431条 (持仓, 标签) 对
- **aggregate** → 658条 fund_tag_map，141只基金
- **search --themes "AI,Technology"** → fund_id=96 score=49.47% 由 NVIDIA:9.95%、BROADCOM:7.03% 驱动

## CLI

```bash
# 从项目根目录（或 输出 目录上一级）
py -m fund_tagging.run --db fund_tagging.db ingest --csv top_holdings_detail.csv
py -m fund_tagging.run --db fund_tagging.db seed
py -m fund_tagging.run --db fund_tagging.db aggregate
py -m fund_tagging.run --db fund_tagging.db search --themes "AI,Technology" --limit 10
```

## 接入 LLM

只需改一个函数 **holding_tagger.py** 里的 `tag_holdings_by_llm`，其余全部不动。
