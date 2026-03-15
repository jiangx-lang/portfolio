"""
Holding name standardization for consistent matching with holding_tag_map.
中英文合并、去法律后缀、去行业括号。
"""
import re
from typing import List, Set


# Suffixes to strip (case-insensitive) for normalization
STRIP_SUFFIXES = (
    "CORP", "CORPORATION", "CO", "INC", "INC.", "LTD", "LTD.", "LIMITED",
    "PLC", "PLC.", "NV", "SA", "S.A.", "AG", "GMBH", "LP", "LLC", "L.L.C.",
    "REG", "REGS", "REG S", "REG S/144A", "144A",
)

# Pattern to remove parenthetical suffixes like "(Restaurants)" or "(Fertilizers & Agricultural Chemicals)"
PAREN_PATTERN = re.compile(r"\s*\([^)]*\)\s*$")


def standardize_holding_name(raw: str) -> str:
    """
    Normalize a holding name for use as holding_name_std.
    - Uppercase
    - Strip trailing legal suffixes (CORP, INC, LTD, etc.)
    - Optionally strip parenthetical industry/sector notes
    - Collapse multiple spaces, strip
    """
    if not raw or not isinstance(raw, str):
        return ""
    s = raw.upper().strip()
    s = PAREN_PATTERN.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Strip trailing comma and known suffixes (repeated to handle "INC." then "LTD")
    for _ in range(3):
        if s.endswith(","):
            s = s[:-1].strip()
        for suffix in STRIP_SUFFIXES:
            if s.endswith(" " + suffix):
                s = s[: -len(suffix) - 1].strip()
            elif s.endswith("." + suffix):
                s = s[: -len(suffix) - 2].strip()
    return s.strip() or raw.strip()


def extract_unique_holdings(rows: List[dict], name_key: str = "holding_name") -> Set[str]:
    """From a list of dicts (e.g. CSV rows), return unique standardized holding names."""
    return {standardize_holding_name(r.get(name_key) or "") for r in rows if r.get(name_key)}
