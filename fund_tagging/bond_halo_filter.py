"""
债券 HALO 过滤：从 holding_tag_map 中移除「纯国债/政府债」的 HALO 标签，
保留真正的基础设施债（如 Mumbai Airport MTN、Greenko、ICIL Aero）及亚洲基础设施 REITs（CapitaLand、Keppel DC）。
"""
import re
# tag_id for HALO（theme）
TAG_ID_HALO = 110

# 纯国债/政府债等：命中则移除 HALO（除非同时命中下方 whitelist）
PURE_BOND_HALO_EXCLUDE = re.compile(
    r"""
    USTN\b|USTB\b|US\s+TREASURY|US\s+T\s*\d|TREASURY\s+BOND
    |GOVT\s+BOND|GOVERNMENT\s+BOND|GILTS?\b|BUND\b
    |INDONESIA\s+GOV|KOREA\s+GOV|MALAYSIA\s+GOV|THAILAND\s+GOV
    |SOVEREIGN\s+BOND|GOVERNMENT\s+OF\s+\w+\s+BOND
    |ISHARES\s+.*TREASURY|ISHARES\s+.*GOVT
    |\bBOND\s+REG[S]?\s+\d|REG\s+S/?\s*144A\s+.*(?:GOV|TREASURY)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# 保留 HALO 的债券/REIT：基础设施债或亚洲基础设施 REIT
BOND_HALO_WHITELIST = re.compile(
    r"""
    MUMBAI\s+AIRPORT|GREENKO\b|ICIL\s+AERO
    |CAPITALAND\b|KEPPEL\s+DC|KEPPEL\s+REIT
    |DATA\s+CENTRE|DATACENTRE|INFRASTRUCTURE\s+REIT
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _is_pure_bond_holding(holding_name_std: str) -> bool:
    """命中「纯国债/政府债」且不在基础设施债白名单内 → 应移除 HALO。"""
    if not (holding_name_std or holding_name_std.strip()):
        return False
    if BOND_HALO_WHITELIST.search(holding_name_std):
        return False
    return bool(PURE_BOND_HALO_EXCLUDE.search(holding_name_std))


def remove_halo_from_pure_bonds(
    conn,
    tag_id_halo: int = TAG_ID_HALO,
) -> int:
    """
    从 holding_tag_map 中删除「纯国债/政府债」的 HALO 映射，保留基础设施债与 REIT。
    返回删除的行数。
    """
    rows = conn.execute(
        """
        SELECT holding_name_std FROM holding_tag_map
        WHERE tag_id = ?
        """,
        (tag_id_halo,),
    ).fetchall()
    to_delete = [
        (r[0], tag_id_halo)
        for r in rows
        if _is_pure_bond_holding(r[0])
    ]
    for holding_name_std, tid in to_delete:
        conn.execute(
            "DELETE FROM holding_tag_map WHERE holding_name_std = ? AND tag_id = ?",
            (holding_name_std, tid),
        )
    conn.commit()
    return len(to_delete)
