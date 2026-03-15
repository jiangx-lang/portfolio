"""
CLI entry point.

Usage:
  python -m fund_tagging.run --db fund_tagging.db ingest --csv top_holdings_detail.csv
  python -m fund_tagging.run --db fund_tagging.db seed
  python -m fund_tagging.run --db fund_tagging.db tag
  python -m fund_tagging.run --db fund_tagging.db aggregate
  python -m fund_tagging.run --db fund_tagging.db search --themes "AI,Technology" --limit 10
  python -m fund_tagging.run --db fund_tagging.db search --region "US" --themes "SaaS"
  python -m fund_tagging.run --db fund_tagging.db fund --id 25
  python -m fund_tagging.run --db fund_tagging.db stats
"""

import argparse
import logging
import sys
from pathlib import Path

# Allow running as module from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="fund_tagging",
        description="Bottom-up fund tagging & search engine",
    )
    p.add_argument("--db", required=True, help="Path to SQLite database file")

    sub = p.add_subparsers(dest="command", required=True)

    # ingest
    ingest = sub.add_parser("ingest", help="Load holdings CSV → fund_holding_exposure")
    ingest.add_argument("--csv", required=True, help="Path to top_holdings_detail.csv")

    # seed
    sub.add_parser("seed", help="Seed tag_taxonomy + example holding_tag_map")

    # tag (apply rule-based tagger to all holdings in exposure table)
    sub.add_parser("tag", help="Apply rule tagger to all holdings in exposure table")

    # aggregate
    sub.add_parser("aggregate", help="Recalculate fund_tag_map for all funds")

    # search
    srch = sub.add_parser("search", help="Search funds by tag criteria")
    srch.add_argument("--region",  help="Comma-separated region tags, e.g. US,Asia")
    srch.add_argument("--sector",  help="Comma-separated sector tags")
    srch.add_argument("--themes",  help="Comma-separated theme tags, e.g. AI,SaaS")
    srch.add_argument("--styles",  help="Comma-separated style tags")
    srch.add_argument("--custom",  help="Comma-separated custom tags, e.g. H-HardAssets")
    srch.add_argument("--min-score", type=float, default=0.0)
    srch.add_argument("--limit",   type=int,   default=15)

    # fund detail
    fd = sub.add_parser("fund", help="Show tag profile for a single fund")
    fd.add_argument("--id", type=int, required=True, help="fund_id")

    # stats
    sub.add_parser("stats", help="Print database statistics")

    return p


def _csv_list(s: str | None) -> list[str] | None:
    if not s:
        return None
    return [x.strip() for x in s.split(",") if x.strip()]


def main(argv: list[str] | None = None) -> None:
    parser = _build_parser()
    args   = parser.parse_args(argv)

    # configure DB before importing any module that calls get_conn()
    from fund_tagging import db
    db.configure(args.db)
    db.init_schema()

    # ── ingest ────────────────────────────────────────────────────
    if args.command == "ingest":
        from fund_tagging.ingestion import run_ingestion
        written, uniques = run_ingestion(args.csv)
        print(f"✅  Ingested {written} exposure rows  |  {len(uniques)} unique holdings")

    # ── seed ──────────────────────────────────────────────────────
    elif args.command == "seed":
        from fund_tagging.seed_tags import seed_taxonomy, seed_example_holding_tags
        n_tags     = seed_taxonomy()
        n_holdings = seed_example_holding_tags()
        print(f"✅  Seeded {n_tags} taxonomy tags  |  {n_holdings} holding→tag rows")

    # ── tag ───────────────────────────────────────────────────────
    elif args.command == "tag":
        from fund_tagging.db import get_conn
        from fund_tagging.holding_tagger import run_tagger
        conn = get_conn()
        try:
            holdings = [
                row[0] for row in conn.execute(
                    "SELECT DISTINCT holding_name_std FROM fund_holding_exposure"
                )
            ]
        finally:
            conn.close()
        n = run_tagger(holdings, use_rules=True, use_llm=False)
        print(f"✅  Tagged {n} (holding, tag) pairs via rules")

    # ── aggregate ─────────────────────────────────────────────────
    elif args.command == "aggregate":
        from fund_tagging.aggregation import recalculate_all_funds
        total = recalculate_all_funds()
        print(f"✅  Aggregation complete — {total} fund_tag_map rows written")

    # ── search ────────────────────────────────────────────────────
    elif args.command == "search":
        from fund_tagging.search import FundSearchEngine
        criteria: dict = {}
        if _csv_list(args.region):  criteria["region"]  = _csv_list(args.region)
        if _csv_list(args.sector):  criteria["sector"]  = _csv_list(args.sector)
        if _csv_list(args.themes):  criteria["themes"]  = _csv_list(args.themes)
        if _csv_list(args.styles):  criteria["styles"]  = _csv_list(args.styles)
        if _csv_list(args.custom):  criteria["custom"]  = _csv_list(args.custom)
        criteria["min_score"] = args.min_score
        criteria["limit"]     = args.limit

        engine  = FundSearchEngine()
        results = engine.search(criteria)

        if not results:
            print("No matching funds found.")
            return

        print(f"\n{'═'*68}")
        print(f"  Search: {criteria}  →  {len(results)} results")
        print(f"{'═'*68}")
        for r in results:
            print()
            print(r.to_display())
        print()

    # ── fund detail ───────────────────────────────────────────────
    elif args.command == "fund":
        _show_fund_profile(args.id)

    # ── stats ─────────────────────────────────────────────────────
    elif args.command == "stats":
        _show_stats()


def _show_fund_profile(fund_id: int) -> None:
    from fund_tagging.db import get_conn
    import json

    conn = get_conn()
    try:
        # Fund meta
        meta = conn.execute(
            "SELECT * FROM funds WHERE id=?", (fund_id,)
        ).fetchone() if _table_exists(conn, "funds") else None

        if meta:
            print(f"\n{meta['fund_name_cn']}  [{meta['sc_risk_rating']}]"
                  f"  AUM:{meta['fund_aum_usd']}M")

        # Holdings
        holdings = conn.execute("""
            SELECT holding_name_std, weight_pct, rank
            FROM fund_holding_exposure
            WHERE fund_id=?
              AND as_of_date=(SELECT MAX(as_of_date)
                              FROM fund_holding_exposure WHERE fund_id=?)
            ORDER BY rank
        """, (fund_id, fund_id)).fetchall()

        print(f"\nTop holdings:")
        for h in holdings:
            print(f"  {h['rank']:>2}. {h['holding_name_std']:<40} {h['weight_pct']:>6.2f}%")

        # Tags
        tags = conn.execute("""
            SELECT tt.tag_name, tt.category, ftm.aggregated_score, ftm.explanation
            FROM fund_tag_map ftm
            JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
            WHERE ftm.fund_id=?
            ORDER BY ftm.aggregated_score DESC
            LIMIT 20
        """, (fund_id,)).fetchall()

        print(f"\nTag profile:")
        for t in tags:
            expl = json.loads(t["explanation"] or "{}")
            top3 = sorted(expl.items(), key=lambda x: -x[1])[:3]
            driven = ", ".join(f"{h}:{c:.2f}%" for h, c in top3)
            print(f"  [{t['category']:8}] {t['tag_name']:<20} "
                  f"score={t['aggregated_score']:>7.3f}  ← {driven}")
    finally:
        conn.close()


def _show_stats() -> None:
    from fund_tagging.db import get_conn
    conn = get_conn()
    try:
        def count(table):
            try:
                return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except Exception:
                return "n/a"

        print("\nDatabase statistics:")
        print(f"  tag_taxonomy          : {count('tag_taxonomy'):>8}")
        print(f"  holding_tag_map       : {count('holding_tag_map'):>8}")
        print(f"  fund_holding_exposure : {count('fund_holding_exposure'):>8}")
        print(f"  fund_tag_map          : {count('fund_tag_map'):>8}")

        # Tag score leaderboard
        rows = conn.execute("""
            SELECT tt.tag_name, tt.category,
                   COUNT(DISTINCT ftm.fund_id) AS fund_count,
                   ROUND(AVG(ftm.aggregated_score), 2) AS avg_score
            FROM fund_tag_map ftm
            JOIN tag_taxonomy tt ON tt.tag_id = ftm.tag_id
            GROUP BY ftm.tag_id
            ORDER BY fund_count DESC
            LIMIT 15
        """).fetchall()
        print("\nTop tags by fund coverage:")
        print(f"  {'Tag':<22} {'Category':<10} {'Funds':>6}  {'Avg Score':>10}")
        print("  " + "─" * 54)
        for r in rows:
            print(f"  {r['tag_name']:<22} {r['category']:<10} "
                  f"{r['fund_count']:>6}  {r['avg_score']:>10.2f}%")
    finally:
        conn.close()


def _table_exists(conn, name: str) -> bool:
    r = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return r is not None


if __name__ == "__main__":
    main()
