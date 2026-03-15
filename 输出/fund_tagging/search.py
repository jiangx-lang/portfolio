"""
FundSearchEngine.search(criteria_dict): AND 多条件，可解释返回.
"""
import json
from typing import Dict, List, Any, Optional

from .db import get_connection


class FundSearchEngine:
    """
    Search funds by dynamic criteria (region, sector, themes, etc.).
    Results sorted by combined aggregated_score; payload includes explanation per tag.
    """

    def __init__(self, conn=None, db_path: Optional[str] = None):
        self._conn = conn
        self._db_path = db_path
        self._own_conn = conn is None and db_path is not None

    @property
    def conn(self):
        if self._conn is not None:
            return self._conn
        if self._db_path:
            self._conn = get_connection(self._db_path)
            return self._conn
        raise RuntimeError("FundSearchEngine needs conn or db_path")

    def close(self):
        if self._own_conn and self._conn is not None:
            self._conn.close()
            self._conn = None

    def _resolve_tag_ids(self, criteria: Dict[str, Any]) -> List[int]:
        """Map criteria to tag_ids. Match tag_taxonomy by tag_name and category."""
        tag_ids = []
        category_map = {
            "region": "region", "regions": "region",
            "sector": "sector", "sectors": "sector",
            "theme": "theme", "themes": "theme",
            "style": "style", "styles": "style",
            "custom": "custom",
        }
        for key, value in criteria.items():
            if value is None:
                continue
            cat = category_map.get(key.lower(), "custom")
            names = [value] if isinstance(value, str) else list(value)
            for name in names:
                if not name:
                    continue
                rows = self.conn.execute(
                    """
                    SELECT tag_id FROM tag_taxonomy
                    WHERE category = ? AND (tag_name = ? OR tag_name = ? COLLATE NOCASE OR aliases LIKE ?)
                    """,
                    (cat, name.strip(), name.strip(), f'%"{(name.strip())}"%'),
                ).fetchall()
                for (tid,) in rows:
                    tag_ids.append(tid)
                if not rows:
                    r = self.conn.execute(
                        "SELECT tag_id FROM tag_taxonomy WHERE category = ? AND LOWER(tag_name) = ?",
                        (cat, name.strip().lower()),
                    ).fetchone()
                    if r:
                        tag_ids.append(r[0])
        return list(dict.fromkeys(tag_ids))

    def search(
        self,
        criteria: Dict[str, Any],
        min_score: Optional[float] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search by criteria. Returns funds sorted by combined_score.
        Each result: fund_id, combined_score, matches: [{ tag_id, tag_name, aggregated_score, explanation }].
        Frontend can show: "Matches AI (Total Score: 12.7%) - Driven by NVIDIA (8.5%), Microsoft (4.2%)".
        """
        tag_ids = self._resolve_tag_ids(criteria)
        if not tag_ids:
            return []

        placeholders = ",".join("?" * len(tag_ids))
        sep = chr(0x1F)
        rows = self.conn.execute(
            f"""
            SELECT m.fund_id, SUM(m.aggregated_score) AS combined_score,
                   GROUP_CONCAT(CAST(m.tag_id AS TEXT), ',') AS tag_ids,
                   GROUP_CONCAT(CAST(m.aggregated_score AS TEXT), ',') AS scores,
                   GROUP_CONCAT(m.explanation, ?) AS explanations
            FROM fund_tag_map m
            WHERE m.tag_id IN ({placeholders})
            GROUP BY m.fund_id
            """,
            (sep,) + tuple(tag_ids),
        ).fetchall()

        name_rows = self.conn.execute(
            f"SELECT tag_id, tag_name FROM tag_taxonomy WHERE tag_id IN ({placeholders})", tag_ids
        ).fetchall()
        tnames = {tid: tname for tid, tname in name_rows}

        out = []
        for r in rows:
            fund_id, combined_score, tag_ids_str, scores_str, explanations_str = r
            if min_score is not None and combined_score < min_score:
                continue
            tag_id_list = [int(x) for x in (tag_ids_str or "").split(",") if x.strip()]
            scores_list = [float(x) for x in (scores_str or "").split(",") if x.strip()]
            expl_list = (explanations_str or "").split(sep)
            if len(expl_list) < len(tag_id_list):
                expl_list = expl_list + [""] * (len(tag_id_list) - len(expl_list))
            matches = []
            for i, tid in enumerate(tag_id_list):
                sc = scores_list[i] if i < len(scores_list) else 0
                raw = expl_list[i] if i < len(expl_list) else "{}"
                try:
                    expl = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    expl = {}
                matches.append({
                    "tag_id": tid,
                    "tag_name": tnames.get(tid, str(tid)),
                    "aggregated_score": round(sc, 4),
                    "explanation": expl,
                })
            out.append({
                "fund_id": fund_id,
                "combined_score": round(combined_score, 4),
                "matches": matches,
            })

        out.sort(key=lambda x: -x["combined_score"])
        return out[:limit]
