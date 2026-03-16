# Fund Tagging (Bottom-Up)

Tag **holdings** first; fund-level tags are aggregated from top-10 exposure. Search returns funds with **explanation** (which holdings drove the score).

## Schema (SQLite / PostgreSQL compatible)

- **tag_taxonomy**: `tag_id`, `tag_name`, `category` (region/sector/theme/style/custom), `parent_tag_id`, `aliases` (JSON).
- **holding_tag_map**: `holding_name_std`, `tag_id`, `confidence_score` (0–1), `source` (rule/llm/manual).
- **fund_holding_exposure**: `fund_id`, `holding_name_std`, `weight_pct`, `rank`, `as_of_date`.
- **fund_tag_map**: `fund_id`, `tag_id`, `aggregated_score`, `explanation` (JSON: holding → contribution %).

## Pipeline

1. **Ingest**: `top_holdings_detail.csv` → standardize names → `fund_holding_exposure`.
2. **Tag holdings**: Populate `holding_tag_map` via rules / LLM / manual (see `holding_tagger.py`).
3. **Aggregate**: `calculate_fund_tags(fund_id)` → `Fund_Score = SUM(weight_pct * confidence)` → `fund_tag_map` + explanation.
4. **Search**: `FundSearchEngine.search(criteria)` → funds sorted by combined score, with per-tag explanation.

## CLI

```bash
# From project root
py -m fund_tagging.run --db fund_tagging.db ingest --csv top_holdings_detail.csv
py -m fund_tagging.run --db fund_tagging.db seed          # taxonomy + example holding tags
py -m fund_tagging.run --db fund_tagging.db migrate       # 旧库补列/补标签（见下方 Workflow）
py -m fund_tagging.run --db fund_tagging.db tag
py -m fund_tagging.run --db fund_tagging.db aggregate
py -m fund_tagging.run --db fund_tagging.db search --themes "AI,Technology" --limit 10
```

---

## 云端 / 旧库迁移 (Workflow)

**问题所在**：腾讯云或历史环境里的 `fund_tagging.db` 可能是旧 schema 或不同 seed，会出现：

| 现象 | 原因 |
|------|------|
| `sqlite3.OperationalError: no such column: calculated_at` | `fund_tag_map` 表缺少列 `calculated_at`（当前 schema 要求有该列） |
| `sqlite3.OperationalError: no such column: tagged_at` | `holding_tag_map` 表缺少列 `tagged_at` |
| 主题「高股息」无结果、搜索为空 | `tag_taxonomy` 里没有 `HighDividend` 标签（部分 seed 未包含） |

**解决步骤**（在服务器或本机，对目标 DB 执行）：

1. **先迁移再打标与聚合**（推荐每次部署/换库后跑一次）：
   ```bash
   python3 -m fund_tagging.run --db /path/to/fund_tagging.db migrate
   python3 -m fund_tagging.run --db /path/to/fund_tagging.db tag
   python3 -m fund_tagging.run --db /path/to/fund_tagging.db aggregate
   ```
2. `migrate` 会自动：为 `fund_tag_map` 补 `calculated_at`、为 `holding_tag_map` 补 `tagged_at`、若缺少则插入 `HighDividend`（theme）到 `tag_taxonomy`。已存在则跳过。
3. 若之前已手动加过列/标签，再跑 `migrate` 不会重复操作，可放心执行。

**腾讯云示例**（DB 在 `/root/data/fund_tagging.db`）：

```bash
cd /root/portfolio
git pull origin master
python3 -m fund_tagging.run --db /root/data/fund_tagging.db migrate
python3 -m fund_tagging.run --db /root/data/fund_tagging.db tag
python3 -m fund_tagging.run --db /root/data/fund_tagging.db aggregate
kill $(pgrep -f streamlit)
bash start.sh
```

## Python API

```python
from fund_tagging import get_connection, init_schema, run_ingestion
from fund_tagging import run_tagger, calculate_fund_tags, recalculate_all_funds
from fund_tagging import FundSearchEngine, standardize_holding_name

# Ingest
run_ingestion("top_holdings_detail.csv", "fund_tagging.db")

conn = get_connection("fund_tagging.db")
# Tag holdings (extend holding_tagger.tag_holdings_by_rules / tag_holdings_by_llm)
holdings = [row[0] for row in conn.execute("SELECT DISTINCT holding_name_std FROM fund_holding_exposure").fetchall()]
run_tagger(conn, holdings, use_rules=True, use_llm=False)

# Aggregate
recalculate_all_funds(conn)

# Search
engine = FundSearchEngine(db_path="fund_tagging.db")
for r in engine.search({"themes": ["AI", "SaaS"]}, limit=5):
    print(r["fund_id"], r["combined_score"], r["matches"])
engine.close()
```

## Extending

- **New tags**: Insert into `tag_taxonomy`; then tag holdings in `holding_tag_map`.
- **LLM tagging**: Implement `holding_tagger.tag_holdings_by_llm()` and call `run_tagger(..., use_llm=True)`.
- **Custom rules**: Implement `holding_tagger.tag_holdings_by_rules()` (e.g. sector lookup, keyword match).
