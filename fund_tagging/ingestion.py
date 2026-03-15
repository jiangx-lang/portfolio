"""
Parse top_holdings_detail.csv and populate fund_holding_exposure.

CSV columns expected:
    fund_id, fund_name_cn, source_file, sc_product_codes,
    as_of_date, rank, holding_name, holding_type, weight_pct
"""

import csv
import logging
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple

from .db import get_conn
from .standardizer import standardize

log = logging.getLogger(__name__)


class ExposureRow(NamedTuple):
    fund_id:          int
    holding_name_std: str
    holding_name_raw: str
    holding_type:     str
    weight_pct:       float
    rank:             int | None
    as_of_date:       str


# ── Holding-type normalisation ────────────────────────────────────
_TYPE_MAP = {
    "equity": "equity",
    "bond":   "bond",
    "cash":   "cash",
    "etf":    "etf",
}

def _normalise_type(raw: str) -> str:
    t = (raw or "").strip().lower()
    # iShares / UCITS ETFs that came in as "bond" but are actually ETFs
    return _TYPE_MAP.get(t, "other")


# ── CSV parser ────────────────────────────────────────────────────
def parse_holdings_csv(csv_path: str | Path) -> list[ExposureRow]:
    """
    Read the CSV and return a de-duplicated list of ExposureRow.

    When the same (fund_id, holding_name_std, as_of_date) appears more
    than once we SUM the weights (handles split-line bonds) and keep
    the lowest rank.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    # key → (weight_sum, min_rank, raw_name, holding_type)
    aggregated: dict[tuple, list] = defaultdict(lambda: [0.0, 9999, "", ""])

    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                fund_id    = int(row["fund_id"])
                raw_name   = row["holding_name"].strip()
                std_name   = standardize(raw_name)
                htype      = _normalise_type(row.get("holding_type", ""))
                weight     = float(row["weight_pct"] or 0)
                rank_str   = row.get("rank", "")
                rank       = int(rank_str) if rank_str.strip().isdigit() else None
                as_of_date = row.get("as_of_date", "").strip() or "unknown"
            except (KeyError, ValueError) as exc:
                log.warning("Skipping malformed row: %s — %s", row, exc)
                continue

            if not std_name:
                continue

            key = (fund_id, std_name, as_of_date)
            agg = aggregated[key]
            agg[0] += weight                              # sum weights
            agg[1]  = min(agg[1], rank or 9999)          # keep min rank
            agg[2]  = agg[2] or raw_name                 # first raw name wins
            agg[3]  = agg[3] or htype

    rows = []
    for (fund_id, std_name, as_of_date), (w, r, raw, htype) in aggregated.items():
        rows.append(ExposureRow(
            fund_id          = fund_id,
            holding_name_std = std_name,
            holding_name_raw = raw,
            holding_type     = htype,
            weight_pct       = round(w, 6),
            rank             = r if r < 9999 else None,
            as_of_date       = as_of_date,
        ))

    log.info("Parsed %d exposure rows from %s", len(rows), path.name)
    return rows


def unique_holdings(rows: list[ExposureRow]) -> list[str]:
    """Return sorted list of unique standardised holding names."""
    return sorted({r.holding_name_std for r in rows})


# ── Database writer ───────────────────────────────────────────────
_UPSERT_SQL = """
    INSERT INTO fund_holding_exposure
        (fund_id, holding_name_std, holding_name_raw,
         holding_type, weight_pct, rank, as_of_date)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(fund_id, holding_name_std, as_of_date)
    DO UPDATE SET
        holding_name_raw = excluded.holding_name_raw,
        holding_type     = excluded.holding_type,
        weight_pct       = excluded.weight_pct,
        rank             = excluded.rank
"""

def write_exposures(rows: list[ExposureRow]) -> int:
    """Upsert all rows into fund_holding_exposure. Returns rows written."""
    tuples = [
        (r.fund_id, r.holding_name_std, r.holding_name_raw,
         r.holding_type, r.weight_pct, r.rank, r.as_of_date)
        for r in rows
    ]
    conn = get_conn()
    try:
        conn.executemany(_UPSERT_SQL, tuples)
        conn.commit()
        log.info("Upserted %d rows into fund_holding_exposure", len(tuples))
        return len(tuples)
    finally:
        conn.close()


def run_ingestion(csv_path: str | Path) -> tuple[int, list[str]]:
    """
    Full ingestion pipeline.
    Returns (rows_written, unique_holding_names).
    """
    rows    = parse_holdings_csv(csv_path)
    written = write_exposures(rows)
    uniques = unique_holdings(rows)
    return written, uniques


# ── Backward compatibility for run.py (tag-all, etc.) ──────────────
def get_unique_holdings_from_db(conn) -> set[str]:
    """Return set of distinct holding_name_std from fund_holding_exposure."""
    rows = conn.execute("SELECT DISTINCT holding_name_std FROM fund_holding_exposure").fetchall()
    return {r[0] for r in rows if r[0]}
