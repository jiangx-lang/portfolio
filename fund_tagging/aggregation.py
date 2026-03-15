"""
Bottom-up aggregation engine.

calculate_fund_tags(fund_id)
    For one fund: fetch holdings → fetch tags → compute weighted scores
    → upsert into fund_tag_map.

recalculate_all_funds()
    Run calculate_fund_tags for every fund that has exposures.
"""

import json
import logging
from collections import defaultdict

from .db import get_conn

log = logging.getLogger(__name__)


# ── Core formula ──────────────────────────────────────────────────
#   fund_tag_score = SUM( weight_pct * confidence_score )
#   Scores are capped at 100 (they are %-point weighted sums).


def calculate_fund_tags(fund_id: int) -> dict[int, dict]:
    """
    Compute aggregated tag scores for a single fund.

    Returns a dict keyed by tag_id:
        {
          tag_id: {
            "aggregated_score": float,
            "explanation": { holding_name_std: contribution, … }
          }
        }

    Side effect: upserts results into fund_tag_map.
    """
    conn = get_conn()
    try:
        # 1. Fetch the fund's holdings + weights (latest as_of_date)
        holdings = conn.execute("""
            SELECT fhe.holding_name_std, fhe.weight_pct
            FROM fund_holding_exposure fhe
            WHERE fhe.fund_id = ?
              AND fhe.as_of_date = (
                  SELECT MAX(as_of_date)
                  FROM fund_holding_exposure
                  WHERE fund_id = ?
              )
            ORDER BY fhe.weight_pct DESC
        """, (fund_id, fund_id)).fetchall()

        if not holdings:
            return {}

        # 2. For each holding fetch its tags
        #    Result shape: { (holding_name_std, tag_id): confidence }
        std_names     = list({row["holding_name_std"] for row in holdings})
        placeholders  = ",".join("?" * len(std_names))

        tag_rows = conn.execute(f"""
            SELECT holding_name_std, tag_id, confidence_score
            FROM holding_tag_map
            WHERE holding_name_std IN ({placeholders})
        """, std_names).fetchall()

        if not tag_rows:
            return {}

        # Build lookup: holding_name_std → [(tag_id, confidence)]
        holding_to_tags: dict[str, list[tuple[int, float]]] = defaultdict(list)
        for tr in tag_rows:
            holding_to_tags[tr["holding_name_std"]].append(
                (tr["tag_id"], tr["confidence_score"])
            )

        # 3. Aggregate
        # tag_id → { "score": float, "explanation": {name: contribution} }
        tag_accumulator: dict[int, dict] = defaultdict(
            lambda: {"score": 0.0, "explanation": {}}
        )

        for h in holdings:
            name   = h["holding_name_std"]
            weight = h["weight_pct"]

            for tag_id, confidence in holding_to_tags.get(name, []):
                contribution = round(weight * confidence, 6)
                acc = tag_accumulator[tag_id]
                acc["score"]               += contribution
                acc["explanation"][name]    = round(
                    acc["explanation"].get(name, 0.0) + contribution, 4
                )

        # 4. Round scores
        results: dict[int, dict] = {}
        for tag_id, acc in tag_accumulator.items():
            results[tag_id] = {
                "aggregated_score": round(acc["score"], 4),
                "explanation":      acc["explanation"],
            }

        # 5. Upsert into fund_tag_map
        upsert_data = [
            (
                fund_id,
                tag_id,
                data["aggregated_score"],
                json.dumps(data["explanation"], ensure_ascii=False),
            )
            for tag_id, data in results.items()
        ]
        conn.executemany("""
            INSERT INTO fund_tag_map
                (fund_id, tag_id, aggregated_score, explanation)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(fund_id, tag_id)
            DO UPDATE SET
                aggregated_score = excluded.aggregated_score,
                explanation      = excluded.explanation,
                calculated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        """, upsert_data)
        conn.commit()

        log.debug("fund_id=%d → %d tags computed", fund_id, len(results))
        return results
    finally:
        conn.close()


def recalculate_all_funds(*, batch_size: int = 50) -> int:
    """
    Run calculate_fund_tags for every fund in fund_holding_exposure.
    Returns total number of (fund_id, tag_id) rows written.
    """
    conn = get_conn()
    try:
        fund_ids = [
            row[0] for row in conn.execute(
                "SELECT DISTINCT fund_id FROM fund_holding_exposure"
            )
        ]
    finally:
        conn.close()

    total_rows = 0
    for i in range(0, len(fund_ids), batch_size):
        chunk = fund_ids[i : i + batch_size]
        for fid in chunk:
            results = calculate_fund_tags(fid)
            total_rows += len(results)
        log.info(
            "Aggregation progress: %d / %d funds processed",
            min(i + batch_size, len(fund_ids)),
            len(fund_ids),
        )

    log.info("Aggregation complete. Total fund_tag_map rows: %d", total_rows)
    return total_rows
