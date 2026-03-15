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
py -m fund_tagging.run --db fund_tagging.db aggregate
py -m fund_tagging.run --db fund_tagging.db search --themes "AI,Technology" --limit 10
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
