"""
Holding-name standardisation.

Rules applied in order:
  1. Decode to str, strip whitespace, upper-case
  2. Remove parenthesised sub-industry annotations  e.g. "(Restaurants)"
  3. Strip common legal/corporate suffixes
  4. Collapse repeated whitespace
  5. Normalise common Chinese↔English aliases to a canonical form

The canonical form is always the English version when one exists,
so that "微软" and "MICROSOFT CORP" both resolve to "MICROSOFT".
"""

import re
from functools import lru_cache

# ── Legal suffixes to remove (order matters — longest first) ──────
_SUFFIXES = [
    r"\bCORPORATION\b", r"\bCORP\.?",
    r"\bINCORPORATED\b", r"\bINC\.?",
    r"\bLIMITED\b",      r"\bLTD\.?",
    r"\bCOMPANY\b",      r"\bCO\.?",
    r"\bHOLDINGS?\b",
    r"\bGROUP\b",
    r"\bPLC\.?",
    r"\bS\.?A\.?",       r"\bN\.?V\.?",
    r"\bAG\b",           r"\bSE\b",
    r"\bPTE\b",
    r"\bMFG\b",
]
_SUFFIX_RE = re.compile(
    r"(?:" + "|".join(_SUFFIXES) + r")\s*$",
    re.IGNORECASE,
)

# ── Parenthesised annotations to remove ──────────────────────────
_PAREN_RE = re.compile(r"\s*\([^)]*\)")

# ── Chinese → canonical English mapping ──────────────────────────
# Keys are substrings that appear in Chinese holding names.
# Values are the canonical English name after standardisation.
_CN_TO_EN: dict[str, str] = {
    "英伟达":   "NVIDIA",
    "台积电":   "TAIWAN SEMICONDUCTOR",
    "微软":     "MICROSOFT",
    "苹果":     "APPLE",
    "亚马逊":   "AMAZON",
    "谷歌":     "ALPHABET",
    "腾讯":     "TENCENT",
    "阿里巴巴": "ALIBABA",
    "阿里":     "ALIBABA",
    "博通":     "BROADCOM",
    "阿斯麦":   "ASML",
    "SK海力士": "SK HYNIX",
    "三星":     "SAMSUNG ELECTRONICS",
    "宁德时代": "CATL",
    "渣打银行": "STANDARD CHARTERED",
    "平安保险": "PING AN INSURANCE",
    "施耐德":   "SCHNEIDER ELECTRIC",
    "阿斯利康": "ASTRAZENECA",
    "法国兴业": "SOCIETE GENERALE",
    "贝莱德":   "BLACKROCK",
}


@lru_cache(maxsize=4096)
def standardize(raw: str) -> str:
    """
    Return the canonical, upper-cased, suffix-stripped name for *raw*.
    Results are cached so repeated calls are O(1).
    """
    if not raw or not raw.strip():
        return ""

    name = raw.strip()

    # 1. Chinese alias substitution (before upper-casing to preserve CN chars)
    for cn, en in _CN_TO_EN.items():
        if cn in name:
            name = en
            break

    # 2. Upper-case
    name = name.upper()

    # 3. Remove parenthesised annotations  e.g. "(RESTAURANTS)"
    name = _PAREN_RE.sub("", name)

    # 4. Strip legal suffixes (iteratively — "HOLDINGS LTD" needs two passes)
    for _ in range(3):
        new = _SUFFIX_RE.sub("", name).strip()
        if new == name:
            break
        name = new

    # 5. Collapse whitespace
    name = " ".join(name.split())

    return name


def standardize_batch(names: list[str]) -> list[str]:
    return [standardize(n) for n in names]


# ── Backward compatibility (ingestion, seed_holding_library, __init__) ──
standardize_holding_name = standardize


def extract_unique_holdings(
    rows: list[dict], name_key: str = "holding_name"
) -> set[str]:
    """From a list of dicts (e.g. CSV rows), return unique standardized holding names."""
    return {standardize(r.get(name_key) or "") for r in rows if r.get(name_key)}
