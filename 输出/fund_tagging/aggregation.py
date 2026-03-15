"""
Bottom-up aggregation: score = SUM(weight × confidence), 生成 explanation JSON.
"""
import json
from typing import Dict, List, Optional, Any

from .db import get_connection


def get_fund_holdings(conn, fund_id: int, as_of_date: Optional[str] = None) -> List[tuple]:
    """
    Fetch (holding_name_std, weight_pct) for a fund.
    If as_of_date is None, use the latest as_of_date for that fund.
    """
    if as_of_date:
        rows = conn.execute(
            """
            SELECT holding_name_std, weight_pct
            FROM fund_holding_exposure
            WHERE fund_id = ? AND as_of_date = ?
            ORDER BY rank IS NULL, rank
            """,
            (fund_id, as_of_date),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT holding_name_std, weight_pct
            FROM fund_holding_exposure f
            WHERE f.fund_id = ?
              AND f.as_of_date = (SELECT MAX(as_of_date) FROM fund_holding_exposure WHERE fund_id = ?)
            ORDER BY f.rank IS NULL, f.rank
            """,
            (fund_id, fund_id),
        ).fetchall()
    return [(r[0], r[1]) for r in rows]


def get_holding_tags(conn, holding_name_std: str) -> List[tuple]:
    """Return (tag_id, confidence_score) for a given holding."""
    rows = conn.execute(
        """
        SELECT tag_id, confidence_score
        FROM holding_tag_map
        WHERE holding_name_std = ?
        """,
        (holding_name_std,),
    ).fetchall()
    return [(r[0], r[1]) for r in rows]


def calculate_fund_tags(
    conn,
    fund_id: int,
    as_of_date: Optional[str] = None,
    upsert: bool = True,
) -> List[Dict[str, Any]]:
    """
    Bottom-up aggregation for one fund.
    Fund_Tag_Score = SUM(weight_pct * confidence_score).
    explanation = { holding_name: contribution_pct }.
    """
    holdings = get_fund_holdings(conn, fund_id, as_of_date)
    if not holdings:
        return []

    tag_scores: Dict[int, tuple] = {}

    for holding_name_std, weight_pct in holdings:
        for tag_id, confidence in get_holding_tags(conn, holding_name_std):
            contribution = round(weight_pct * confidence, 4)
            if tag_id not in tag_scores:
                tag_scores[tag_id] = (0.0, {})
            prev_score, prev_expl = tag_scores[tag_id]
            tag_scores[tag_id] = (prev_score + contribution, {**prev_expl, holding_name_std: round(contribution, 2)})

    results = []
    for tag_id, (aggregated_score, explanation) in tag_scores.items():
        results.append({
            "tag_id": tag_id,
            "aggregated_score": round(aggregated_score, 4),
            "explanation": explanation,
        })
        if upsert:
            explanation_json = json.dumps(explanation, ensure_ascii=False)
            as_of_used = as_of_date
            if not as_of_used and holdings:
                as_of_used = conn.execute(
                    "SELECT as_of_date FROM fund_holding_exposure WHERE fund_id = ? LIMIT 1",
                    (fund_id,),
                ).fetchone()
                as_of_used = as_of_used[0] if as_of_used else None
            conn.execute(
                """
                INSERT INTO fund_tag_map (fund_id, tag_id, aggregated_score, explanation, as_of_date, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(fund_id, tag_id) DO UPDATE SET
                    aggregated_score = excluded.aggregated_score,
                    explanation = excluded.explanation,
                    as_of_date = excluded.as_of_date,
                    updated_at = datetime('now')
                """,
                (fund_id, tag_id, aggregated_score, explanation_json, as_of_used),
            )
    if upsert and results:
        conn.commit()
    return results


def recalculate_all_funds(conn, as_of_date: Optional[str] = None) -> int:
    """Run calculate_fund_tags for every fund in fund_holding_exposure; return count of funds processed."""
    fund_ids = conn.execute("SELECT DISTINCT fund_id FROM fund_holding_exposure").fetchall()
    n = 0
    for (fid,) in fund_ids:
        calculate_fund_tags(conn, fid, as_of_date=as_of_date, upsert=True)
        n += 1
    return n
