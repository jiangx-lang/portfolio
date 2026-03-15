"""
CLI 一键跑完整流程.
  py -m fund_tagging.run --db fund_tagging.db ingest --csv top_holdings_detail.csv
  py -m fund_tagging.run --db fund_tagging.db seed
  py -m fund_tagging.run --db fund_tagging.db aggregate
  py -m fund_tagging.run --db fund_tagging.db search --themes "AI,Technology" --limit 10
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fund_tagging.db import get_connection, init_schema
from fund_tagging.ingestion import run_ingestion
from fund_tagging.seed_tags import seed_taxonomy, seed_example_holding_tags
from fund_tagging.aggregation import recalculate_all_funds
from fund_tagging.search import FundSearchEngine


def cmd_ingest(csv_path: str, db_path: str):
    out = run_ingestion(csv_path, db_path, init_schema_if_missing=True)
    print(f"Ingestion: {out['rows_parsed']} rows parsed, {out['exposure_rows_upserted']} exposure rows, {out['unique_holdings_count']} unique holdings.")


def cmd_seed(db_path: str):
    conn = get_connection(db_path)
    init_schema(conn)
    seed_taxonomy(conn)
    n = seed_example_holding_tags(conn)
    print(f"Seed: taxonomy + {n} example holding tags.")
    conn.close()


def cmd_aggregate(db_path: str):
    conn = get_connection(db_path)
    n = recalculate_all_funds(conn)
    print(f"Aggregate: {n} funds updated in fund_tag_map.")
    conn.close()


def cmd_search(db_path: str, region: str, sectors: str, themes: str, limit: int):
    criteria = {}
    if region:
        criteria["region"] = region
    if sectors:
        criteria["sectors"] = [s.strip() for s in sectors.split(",")]
    if themes:
        criteria["themes"] = [s.strip() for s in themes.split(",")]
    if not criteria:
        criteria = {"themes": ["Technology", "AI"]}
    engine = FundSearchEngine(db_path=db_path)
    try:
        results = engine.search(criteria, limit=limit)
        for r in results:
            print(f"  fund_id={r['fund_id']} score={r['combined_score']:.2f}%")
            for m in r["matches"]:
                expl = ", ".join(f"{k}:{v}%" for k, v in m["explanation"].items())
                print(f"    - {m['tag_name']}: {m['aggregated_score']:.2f}% | {expl}")
    finally:
        engine.close()


def main():
    ap = argparse.ArgumentParser(description="Fund tagging pipeline")
    ap.add_argument("--db", default="fund_tagging.db", help="Tagging DB path")
    sub = ap.add_subparsers(dest="command", required=True)
    p_ingest = sub.add_parser("ingest")
    p_ingest.add_argument("--csv", default="top_holdings_detail.csv", help="Path to top_holdings_detail.csv")
    sub.add_parser("seed")
    sub.add_parser("aggregate")
    p_search = sub.add_parser("search")
    p_search.add_argument("--region", default="")
    p_search.add_argument("--sectors", default="")
    p_search.add_argument("--themes", default="")
    p_search.add_argument("--limit", type=int, default=10)
    args = ap.parse_args()

    if args.command == "ingest":
        cmd_ingest(args.csv, args.db)
    elif args.command == "seed":
        cmd_seed(args.db)
    elif args.command == "aggregate":
        cmd_aggregate(args.db)
    elif args.command == "search":
        cmd_search(args.db, args.region, args.sectors, args.themes, args.limit)


if __name__ == "__main__":
    main()
