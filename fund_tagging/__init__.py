"""
Bottom-up fund tagging: tag holdings first, aggregate to funds, search with explanation.
"""
from .db import configure, get_conn, init_schema
from .standardizer import standardize_holding_name, extract_unique_holdings
from .ingestion import parse_holdings_csv, run_ingestion, get_unique_holdings_from_db
from .holding_tagger import run_tagger, tag_holdings_by_rules, tag_holdings_by_llm, upsert_holding_tag_map
from .aggregation import calculate_fund_tags, recalculate_all_funds
from .search import FundSearchEngine

__all__ = [
    "configure",
    "get_conn",
    "init_schema",
    "standardize_holding_name",
    "extract_unique_holdings",
    "parse_holdings_csv",
    "run_ingestion",
    "get_unique_holdings_from_db",
    "run_tagger",
    "tag_holdings_by_rules",
    "tag_holdings_by_llm",
    "upsert_holding_tag_map",
    "calculate_fund_tags",
    "recalculate_all_funds",
    "FundSearchEngine",
]
