"""
Data ingestion: parse top_holdings_detail.csv and populate fund_holding_exposure.
自动去重合并权重。
"""
import csv
from collections import defaultdict
from pathlib import Path
from typing import List, Dict, Set, Any

from .db import get_connection, init_schema
from .standardizer import standardize_holding_name, extract_unique_holdings


def parse_holdings_csv(csv_path: str | Path) -> List[Dict[str, Any]]:
    """Parse top_holdings_detail.csv; return list of dicts with keys as column names."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            row = {k.strip(): v for k, v in r.items()}
            rows.append(row)
    return rows


def rows_to_exposure_tuples(
    rows: List[Dict[str, Any]],
    fund_id_key: str = "fund_id",
    holding_name_key: str = "holding_name",
    weight_key: str = "weight_pct",
    rank_key: str = "rank",
    as_of_date_key: str = "as_of_date",
):
    """Convert CSV rows to (fund_id, holding_name_std, weight_pct, rank, as_of_date).
    Aggregates by (fund_id, holding_name_std, as_of_date): sum weight_pct, min rank.
    """
    key_to_weight_rank: Dict[tuple, tuple] = defaultdict(lambda: (0.0, None))
    for r in rows:
        try:
            fid = int(r.get(fund_id_key) or 0)
        except (TypeError, ValueError):
            continue
        raw_name = r.get(holding_name_key) or ""
        if not raw_name:
            continue
        std_name = standardize_holding_name(raw_name)
        try:
            w = float(r.get(weight_key) or 0)
        except (TypeError, ValueError):
            w = 0.0
        try:
            rank = int(r.get(rank_key) or 0)
        except (TypeError, ValueError):
            rank = None
        as_of = (r.get(as_of_date_key) or "").strip() or None
        key = (fid, std_name, as_of)
        prev_w, prev_r = key_to_weight_rank[key]
        new_rank = rank if prev_r is None else (min(prev_r, rank) if rank is not None else prev_r)
        key_to_weight_rank[key] = (prev_w + w, new_rank)
    out = [(k[0], k[1], wr[0], wr[1], k[2]) for k, wr in key_to_weight_rank.items()]
    return out


def upsert_fund_holding_exposure(conn, tuples: List[tuple]) -> int:
    """Insert or replace rows into fund_holding_exposure. Returns count inserted/updated."""
    conn.execute("DELETE FROM fund_holding_exposure")
    if not tuples:
        conn.commit()
        return 0
    conn.executemany(
        """
        INSERT INTO fund_holding_exposure (fund_id, holding_name_std, weight_pct, rank, as_of_date)
        VALUES (?, ?, ?, ?, ?)
        """,
        tuples,
    )
    conn.commit()
    return len(tuples)


def get_unique_holdings_from_db(conn) -> Set[str]:
    """Return set of distinct holding_name_std from fund_holding_exposure."""
    rows = conn.execute("SELECT DISTINCT holding_name_std FROM fund_holding_exposure").fetchall()
    return {r[0] for r in rows if r[0]}


def run_ingestion(
    csv_path: str | Path,
    db_path: str | Path,
    init_schema_if_missing: bool = True,
) -> Dict[str, any]:
    """
    Full ingestion pipeline:
    1. Parse CSV
    2. Standardize names and build exposure tuples
    3. (Optionally) init schema
    4. Upsert fund_holding_exposure
    Returns dict with keys: rows_parsed, exposure_rows_upserted, unique_holdings_count.
    """
    rows = parse_holdings_csv(csv_path)
    tuples = rows_to_exposure_tuples(rows)
    unique_std = {t[1] for t in tuples}

    conn = get_connection(db_path)
    try:
        if init_schema_if_missing:
            init_schema(conn)
        n = upsert_fund_holding_exposure(conn, tuples)
        return {
            "rows_parsed": len(rows),
            "exposure_rows_upserted": n,
            "unique_holdings_count": len(unique_std),
        }
    finally:
        conn.close()
