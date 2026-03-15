"""
从 sc_funds.db 的 credit_rating_allocation 同步债券投资级别/非投资级别到 fund_tag_map.
tag_id 86=Investment Grade, 87=Non-Investment Grade.
"""
import sqlite3
from pathlib import Path
from typing import Optional

# 投资级：AAA/AA/A/BBB 及其子级（如 A+、BBB-）
def _is_investment_grade(rating: str) -> bool:
    r = (rating or "").strip().upper()
    if not r:
        return False
    return (
        r.startswith("AAA")
        or r.startswith("AA")
        or r.startswith("BBB")
        or (r.startswith("A") and not r.startswith("AB"))
    )


def _get_latest_credit_by_fund(sc_conn: sqlite3.Connection):
    """返回 fund_id -> [(rating, weight_pct), ...]，仅取每个 fund 最新 as_of_date."""
    rows = sc_conn.execute(
        """
        SELECT c.fund_id, c.rating, c.weight_pct
        FROM credit_rating_allocation c
        INNER JOIN (
            SELECT fund_id, MAX(as_of_date) AS md
            FROM credit_rating_allocation
            GROUP BY fund_id
        ) t ON c.fund_id = t.fund_id AND c.as_of_date = t.md
        """
    ).fetchall()
    by_fund = {}
    for fund_id, rating, weight_pct in rows:
        if fund_id not in by_fund:
            by_fund[fund_id] = []
        by_fund[fund_id].append((rating, weight_pct or 0))
    return by_fund


def enrich_bond_credit_from_sc_funds(
    tag_db_path: str,
    sc_funds_db_path: str,
    tag_id_ig: int = 86,
    tag_id_hy: int = 87,
) -> int:
    """
    根据 sc_funds.db 的 credit_rating_allocation 为基金写入投资级别(86)/非投资级别(87) 到 fund_tag_map.
    返回写入/更新的基金数。
    """
    sc_path = Path(sc_funds_db_path)
    if not sc_path.exists():
        raise FileNotFoundError(f"sc_funds db not found: {sc_path}")
    sc_conn = sqlite3.connect(str(sc_path))
    tag_conn = sqlite3.connect(tag_db_path)
    try:
        credit_by_fund = _get_latest_credit_by_fund(sc_conn)
        # 只处理在 tag 库里有 exposure 的 fund_id
        tag_fund_ids = {
            r[0]
            for r in tag_conn.execute(
                "SELECT DISTINCT fund_id FROM fund_holding_exposure"
            ).fetchall()
        }
        updated_funds = set()
        for fund_id in credit_by_fund:
            if fund_id not in tag_fund_ids:
                continue
            ig_pct = 0.0
            hy_pct = 0.0
            for rating, weight_pct in credit_by_fund[fund_id]:
                if _is_investment_grade(rating):
                    ig_pct += weight_pct
                else:
                    # 非投资级或现金/未评级等
                    hy_pct += weight_pct
            if ig_pct <= 0 and hy_pct <= 0:
                continue
            as_of = tag_conn.execute(
                "SELECT as_of_date FROM fund_holding_exposure WHERE fund_id = ? LIMIT 1",
                (fund_id,),
            ).fetchone()
            as_of = as_of[0] if as_of else None
            expl_ig = f'{{"credit_rating_allocation_IG": {ig_pct}}}'
            expl_hy = f'{{"credit_rating_allocation_HY": {hy_pct}}}'
            if ig_pct > 0:
                tag_conn.execute(
                    """
                    INSERT INTO fund_tag_map (fund_id, tag_id, aggregated_score, explanation, calculated_at)
                    VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                    ON CONFLICT(fund_id, tag_id) DO UPDATE SET
                        aggregated_score = excluded.aggregated_score,
                        explanation = excluded.explanation,
                        calculated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                    """,
                    (fund_id, tag_id_ig, round(ig_pct, 4), expl_ig),
                )
                updated_funds.add(fund_id)
            if hy_pct > 0:
                tag_conn.execute(
                    """
                    INSERT INTO fund_tag_map (fund_id, tag_id, aggregated_score, explanation, calculated_at)
                    VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                    ON CONFLICT(fund_id, tag_id) DO UPDATE SET
                        aggregated_score = excluded.aggregated_score,
                        explanation = excluded.explanation,
                        calculated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                    """,
                    (fund_id, tag_id_hy, round(hy_pct, 4), expl_hy),
                )
                updated_funds.add(fund_id)
        tag_conn.commit()
        return len(updated_funds)
    finally:
        sc_conn.close()
        tag_conn.close()
