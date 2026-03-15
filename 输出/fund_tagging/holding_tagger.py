"""
Holding-level tagger: three backends — rule / LLM placeholder / manual override.
合并逻辑: manual > rule > llm（manual 不覆盖，rule 可覆盖 llm，llm 最低优先级）.
"""
from typing import List, Tuple

# Source labels; priority: manual=3, rule=2, llm=1
SOURCE_RULE = "rule"
SOURCE_LLM = "llm"
SOURCE_MANUAL = "manual"
_SOURCE_PRIORITY = {"manual": 3, "rule": 2, "llm": 1}


def tag_holdings_by_rules(holding_names: List[str], conn=None) -> List[Tuple[str, int, float, str]]:
    """
    Rule-based tagging (e.g. keyword match, sector lookup table).
    Returns list of (holding_name_std, tag_id, confidence_score, source).
    Override or replace with your own rules.
    """
    results = []
    return results


def tag_holdings_by_llm(holding_names: List[str], conn=None) -> List[Tuple[str, int, float, str]]:
    """
    Placeholder: call LLM API to assign tags and confidence per holding.
    Returns list of (holding_name_std, tag_id, confidence_score, source).
    接入 LLM 只需改此函数，其余全部不动。
    """
    results = []
    return results


def _priority(source: str) -> int:
    return _SOURCE_PRIORITY.get(source, 0)


def upsert_holding_tag_map(conn, rows: List[Tuple[str, int, float, str]]) -> int:
    """
    Insert or replace rows into holding_tag_map.
    Merge logic: manual > rule > llm. Do not overwrite existing row if existing source has
    higher priority than new source.
    """
    if not rows:
        return 0
    existing = {}
    for row in conn.execute(
        "SELECT holding_name_std, tag_id, source FROM holding_tag_map"
    ).fetchall():
        existing[(row[0], row[1])] = row[2]
    to_write = []
    for holding_name_std, tag_id, confidence_score, source in rows:
        key = (holding_name_std, tag_id)
        if key in existing and _priority(existing[key]) > _priority(source):
            continue
        to_write.append((holding_name_std, tag_id, confidence_score, source))
    if not to_write:
        conn.commit()
        return 0
    for holding_name_std, tag_id, confidence_score, source in to_write:
        cur = conn.execute(
            "SELECT source FROM holding_tag_map WHERE holding_name_std = ? AND tag_id = ?",
            (holding_name_std, tag_id),
        ).fetchone()
        if cur and _priority(cur[0]) > _priority(source):
            continue
        conn.execute(
            """
            INSERT INTO holding_tag_map (holding_name_std, tag_id, confidence_score, source)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET
                confidence_score = excluded.confidence_score,
                source = excluded.source
            """,
            (holding_name_std, tag_id, confidence_score, source),
        )
    conn.commit()
    return len(to_write)


def run_tagger(
    conn,
    holding_names: List[str],
    use_rules: bool = True,
    use_llm: bool = False,
) -> int:
    """
    Run rule and/or LLM taggers; merge with manual. manual > rule > llm.
    Returns number of (holding, tag) rows upserted.
    """
    all_rows = []
    if use_llm:
        all_rows.extend(tag_holdings_by_llm(holding_names, conn))
    if use_rules:
        all_rows.extend(tag_holdings_by_rules(holding_names, conn))
    # Apply in order so higher-priority (manual if added later) wins when we upsert with priority check
    return upsert_holding_tag_map(conn, all_rows)
