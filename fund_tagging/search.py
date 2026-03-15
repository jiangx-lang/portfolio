"""
FundSearchEngine — flexible, explainable tag-based fund search.

Usage:
    engine = FundSearchEngine()

    # Simple single-criterion
    results = engine.search({"themes": ["AI"]})

    # Multi-criterion AND (all criteria must match)
    results = engine.search({
        "region":  "Asia",
        "themes":  ["AI", "SaaS"],
        "styles":  ["Growth"],
    })

    # Each result includes a human-readable explanation.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from .db import get_conn

log = logging.getLogger(__name__)


# ── Result types ──────────────────────────────────────────────────

@dataclass
class TagMatch:
    """Score and explanation for one matched tag."""
    tag_name:         str
    tag_id:           int
    aggregated_score: float
    explanation:      dict[str, float]      # {holding_name_std: contribution}

    def to_display(self, *, top_n: int = 5) -> str:
        """
        Returns a human-readable string, e.g.:
        'AI (Score: 12.70%) — NVIDIA: 8.50%, MICROSOFT: 4.20%'
        """
        top = sorted(self.explanation.items(), key=lambda x: -x[1])[:top_n]
        driven_by = ", ".join(f"{h}: {c:.2f}%" for h, c in top)
        return (
            f"{self.tag_name} (Score: {self.aggregated_score:.2f}%)"
            + (f" — {driven_by}" if driven_by else "")
        )


@dataclass
class FundResult:
    fund_id:        int
    combined_score: float
    matches:        list[TagMatch] = field(default_factory=list)
    # meta filled in optionally by enrich()
    fund_name_cn:   str  = ""
    sc_risk_rating: str  = ""
    fund_aum_usd:   float | None = None
    mgmt_fee_pct:   float | None = None

    def to_display(self, *, top_holdings: int = 3) -> str:
        lines = [
            f"fund_id={self.fund_id}"
            + (f"  {self.fund_name_cn}" if self.fund_name_cn else "")
            + (f"  [{self.sc_risk_rating}]" if self.sc_risk_rating else ""),
            f"  combined_score={self.combined_score:.2f}%",
        ]
        for m in sorted(self.matches, key=lambda x: -x.aggregated_score):
            lines.append("  " + m.to_display(top_n=top_holdings))
        return "\n".join(lines)


# ── Search engine ─────────────────────────────────────────────────

class FundSearchEngine:
    """
    Criteria dict recognised keys (all optional, combined with AND):
        region   : str | list[str]   — e.g. "US"  or  ["US", "Taiwan"]
        sector   : str | list[str]
        themes   : str | list[str]   — e.g. ["AI", "SaaS"]
        styles   : str | list[str]
        custom   : str | list[str]   — custom tags like HALO sub-tags
        min_score: float             — minimum per-tag aggregated_score (default 0)
        limit    : int               — max results returned (default 20)
    """

    # Maps criteria key → tag_taxonomy.category
    _CRITERIA_TO_CATEGORY: dict[str, str] = {
        "region":  "region",
        "sector":  "sector",
        "themes":  "theme",
        "styles":  "style",
        "custom":  "custom",
    }

    def search(self, criteria: dict[str, Any]) -> list[FundResult]:
        """
        Main entry point.

        Returns a list of FundResult sorted by combined_score descending.
        Each FundResult.matches contains one TagMatch per matched tag,
        with the explanation payload intact.
        """
        min_score: float = float(criteria.get("min_score", 0.0))
        limit:     int   = int(criteria.get("limit", 20))

        # 1. Resolve criteria → tag_ids grouped by criterion key
        criterion_tag_groups: list[tuple[str, list[int]]] = []

        for crit_key, category in self._CRITERIA_TO_CATEGORY.items():
            raw = criteria.get(crit_key)
            if raw is None:
                continue
            names = [raw] if isinstance(raw, str) else list(raw)
            tag_ids = self._resolve_tag_names(names, category)
            if not tag_ids:
                log.warning(
                    "No tags found for criteria key='%s' names=%s", crit_key, names
                )
                # AND-semantics: if a criterion has no tags, no fund can match
                return []
            criterion_tag_groups.append((crit_key, tag_ids))

        if not criterion_tag_groups:
            log.warning("search() called with no resolvable criteria.")
            return []

        # 2. For each criterion, gather (fund_id, tag_id, score, explanation)
        #    Then AND-intersect fund_ids across criterion groups.
        criterion_fund_data: list[dict[int, list[tuple[int, float, dict]]]] = []

        conn = get_conn()
        try:
            for crit_key, tag_ids in criterion_tag_groups:
                placeholders = ",".join("?" * len(tag_ids))
                rows = conn.execute(f"""
                    SELECT ftm.fund_id, ftm.tag_id,
                           ftm.aggregated_score, ftm.explanation
                    FROM fund_tag_map ftm
                    WHERE ftm.tag_id IN ({placeholders})
                      AND ftm.aggregated_score >= ?
                """, tag_ids + [min_score]).fetchall()

                fund_data: dict[int, list[tuple[int, float, dict]]] = {}
                for row in rows:
                    fid = row["fund_id"]
                    try:
                        expl = json.loads(row["explanation"] or "{}")
                    except Exception:
                        expl = {}
                    fund_data.setdefault(fid, []).append(
                        (row["tag_id"], row["aggregated_score"], expl)
                    )
                criterion_fund_data.append(fund_data)
        finally:
            conn.close()

        # 3. AND-intersect: fund must appear in every criterion group
        common_funds = set(criterion_fund_data[0].keys())
        for group in criterion_fund_data[1:]:
            common_funds &= set(group.keys())

        if not common_funds:
            return []

        # 4. Build tag_id → tag_name lookup
        tag_name_map = self._build_tag_name_map(
            {tag_id for _, tags in criterion_tag_groups for tag_id in tags}
        )

        # 5. Assemble FundResult list
        results: list[FundResult] = []
        for fid in common_funds:
            combined_score = 0.0
            matches: list[TagMatch] = []

            for group_idx, (crit_key, tag_ids) in enumerate(criterion_tag_groups):
                group_data = criterion_fund_data[group_idx].get(fid, [])
                for tag_id, score, expl in group_data:
                    combined_score += score
                    matches.append(TagMatch(
                        tag_name         = tag_name_map.get(tag_id, str(tag_id)),
                        tag_id           = tag_id,
                        aggregated_score = score,
                        explanation      = expl,
                    ))

            results.append(FundResult(
                fund_id        = fid,
                combined_score = round(combined_score, 4),
                matches        = matches,
            ))

        results.sort(key=lambda r: -r.combined_score)
        results = results[:limit]

        # 6. Optionally enrich with fund metadata (best-effort)
        self._enrich(results)

        return results

    # ── Helpers ───────────────────────────────────────────────────

    def _resolve_tag_names(
        self, names: list[str], category: str
    ) -> list[int]:
        """
        Look up tag_ids for given names/aliases within a category.
        Case-insensitive; aliases JSON array is searched too.
        """
        tag_ids: list[int] = []
        conn = get_conn()
        try:
            for name in names:
                rows = conn.execute("""
                    SELECT tag_id, aliases FROM tag_taxonomy
                    WHERE category = ?
                      AND (UPPER(tag_name) = UPPER(?)
                           OR UPPER(aliases) LIKE ?)
                """, (category, name, f"%{name.upper()}%")).fetchall()
                for row in rows:
                    if row["tag_id"] not in tag_ids:
                        tag_ids.append(row["tag_id"])
        finally:
            conn.close()
        return tag_ids

    def _build_tag_name_map(self, tag_ids: set[int]) -> dict[int, str]:
        if not tag_ids:
            return {}
        placeholders = ",".join("?" * len(tag_ids))
        conn = get_conn()
        try:
            rows = conn.execute(
                f"SELECT tag_id, tag_name FROM tag_taxonomy "
                f"WHERE tag_id IN ({placeholders})",
                list(tag_ids),
            ).fetchall()
            return {row["tag_id"]: row["tag_name"] for row in rows}
        finally:
            conn.close()

    def _enrich(self, results: list[FundResult]) -> None:
        """
        Attach fund metadata (name, risk rating, AUM, fee) if the
        `funds` table exists in the same database.  Silently skips
        if the table is absent (standalone usage).
        """
        if not results:
            return
        fund_ids = [r.fund_id for r in results]
        placeholders = ",".join("?" * len(fund_ids))
        try:
            conn = get_conn()
            try:
                rows = conn.execute(f"""
                    SELECT id, fund_name_cn, sc_risk_rating,
                           fund_aum_usd, mgmt_fee_pct
                    FROM funds WHERE id IN ({placeholders})
                """, fund_ids).fetchall()
                meta = {row["id"]: row for row in rows}
                for r in results:
                    m = meta.get(r.fund_id)
                    if m:
                        r.fund_name_cn   = m["fund_name_cn"]  or ""
                        r.sc_risk_rating = m["sc_risk_rating"] or ""
                        r.fund_aum_usd   = m["fund_aum_usd"]
                        r.mgmt_fee_pct   = m["mgmt_fee_pct"]
            finally:
                conn.close()
        except Exception as exc:
            log.debug("Could not enrich fund metadata: %s", exc)
