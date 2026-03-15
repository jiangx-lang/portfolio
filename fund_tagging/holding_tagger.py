"""
Holding-level tagging.  Three pluggable backends:

  tag_holdings_by_rules  — fast, deterministic keyword/regex rules
  tag_holdings_by_llm    — placeholder: inject any LLM API call here
  tag_holdings_manual    — one-off overrides via code or CSV

All backends return the same shape:
    list[ (holding_name_std, tag_id, confidence_score, source) ]

`run_tagger` is the single entry-point used by the CLI.
It merges outputs from all active backends and upserts to holding_tag_map.
"""

import json
import logging
import re
from typing import Callable

from .db import get_conn

log = logging.getLogger(__name__)

# Type alias for a tagger result row
TagRow = tuple[str, int, float, str]   # (std_name, tag_id, conf, source)


# ─────────────────────────────────────────────────────────────────
# Tag-id cache  (tag_name → tag_id lookup, populated lazily)
# ─────────────────────────────────────────────────────────────────
_TAG_ID_CACHE: dict[str, int] = {}

def _resolve_tag_id(tag_name: str) -> int | None:
    """Return the tag_id for *tag_name* (case-insensitive). None if missing."""
    if not _TAG_ID_CACHE:
        conn = get_conn()
        try:
            for row in conn.execute(
                "SELECT tag_id, tag_name, aliases FROM tag_taxonomy"
            ):
                _TAG_ID_CACHE[row["tag_name"].upper()] = row["tag_id"]
                try:
                    for alias in json.loads(row["aliases"] or "[]"):
                        _TAG_ID_CACHE[alias.upper()] = row["tag_id"]
                except Exception:
                    pass
        finally:
            conn.close()
    return _TAG_ID_CACHE.get(tag_name.upper())


def _refresh_tag_cache() -> None:
    _TAG_ID_CACHE.clear()


# ─────────────────────────────────────────────────────────────────
# Backend 1: Rule-based tagger
# ─────────────────────────────────────────────────────────────────

# Each rule: (pattern, tag_name, confidence)
# Pattern is matched against the *standardised* holding name (upper-case).
_RULES: list[tuple[re.Pattern, str, float]] = []

def _build_rules() -> None:
    """
    Compile the rule table.  Add or remove entries here freely —
    the rest of the system picks them up automatically.
    """
    raw_rules: list[tuple[str, str, float]] = [
        # ── AI / Technology ─────────────────────────────────────
        (r"\bNVIDIA\b",                    "AI",           1.00),
        (r"\bTSMC\b|TAIWAN SEMICONDUCTOR", "AI",           0.95),
        (r"\bMICROSOFT\b",                 "AI",           0.85),
        (r"\bALPHABET\b|GOOGLE\b",         "AI",           0.85),
        (r"\bAMAZON\b",                    "AI",           0.75),
        (r"\bMETA\b|\bFACEBOOK\b",         "AI",           0.70),
        (r"\bBROADCOM\b",                  "AI",           0.85),
        (r"\bASML\b",                      "AI",           0.90),
        (r"\bAMD\b",                       "AI",           0.90),
        (r"\bSK HYNIX\b",                  "AI",           0.80),
        (r"\bSAMSUNG ELECTRONICS\b",       "AI",           0.65),
        (r"\bAPPLE\b",                     "Technology",   0.80),
        (r"\bNVIDIA\b",                    "Technology",   1.00),
        (r"\bTSMC\b|TAIWAN SEMICONDUCTOR", "Technology",   1.00),
        (r"\bMICROSOFT\b",                 "Technology",   1.00),
        (r"\bALPHABET\b",                  "Technology",   1.00),
        (r"\bSALESFORCE\b",                "SaaS",         0.90),
        (r"\bSERVICENOW\b",                "SaaS",         0.90),
        (r"\bWORKDAY\b",                   "SaaS",         0.85),
        (r"\bSNOWFLAKE\b",                 "SaaS",         0.90),
        (r"\bCLOUDFLARE\b",                "SaaS",         0.90),
        (r"\bADOBE\b",                     "SaaS",         0.75),
        # ── Regions ──────────────────────────────────────────────
        (r"\bNVIDIA\b|\bAPPLE\b|\bMICROSOFT\b|\bALPHABET\b|\bAMAZON\b"
         r"|\bMETA\b|\bBROADCOM\b|\bEXXON\b|\bJPMORGAN\b",
                                            "US",           1.00),
        (r"\bTSMC\b|TAIWAN SEMICONDUCTOR", "Taiwan",       1.00),
        (r"\bSAMSUNG\b|\bSK HYNIX\b|\bHYUNDAI\b",
                                            "Korea",        0.95),
        (r"\bTENCENT\b|\bALIBABA\b|\bBAIDU\b|\bMEITUAN\b|\bCATL\b"
         r"|\bPING AN\b|\bCITIC\b",         "China",        0.95),
        (r"\bHDFC\b|\bRELIANCE\b|\bINFOSYS\b|\bTATA\b|\bBHARTI\b",
                                            "India",        0.95),
        (r"AIRPORT|PORT |PELABUHAN|\bMTR\b", "Asia",        0.70),
        (r"\bASML\b|\bSCHNEIDER\b|\bSAP\b|\bSIEMENS\b|\bASTRAZENECA\b"
         r"|\bNOVO NORDISK\b",              "Europe",       0.90),
        # ── Sectors ──────────────────────────────────────────────
        (r"\bNVIDIA\b|\bAMD\b|\bASML\b|\bTSMC\b|SEMICONDUCTOR",
                                            "Semiconductors", 1.00),
        (r"BANK|FINANCIAL|INSURANCE|ASSET MGMT|MORGAN|GOLDMAN|CITIGROUP",
                                            "Financials",   0.85),
        (r"HEALTH|PHARMA|BIOTECH|MEDICAL|ASTRAZENECA|NOVO NORDISK|ELI LILLY",
                                            "Healthcare",   0.90),
        (r"ENERGY|OIL|GAS|ARAMCO|SHELL|EXXON|CHEVRON|PETRO|CNOOC",
                                            "Energy",       0.90),
        (r"AIRPORT|HIGHWAY|PIPELINE|UTILITY|ELECTRIC|POWER|WATER",
                                            "Infrastructure", 0.90),
        (r"\bREIT\b|REAL ESTATE|PROPERTY",  "Real Estate",  0.90),
        # ── HALO themes ──────────────────────────────────────────
        (r"AIRPORT|PIPELINE|UTILITY|ELECTRIC|WATER|TOLL|\bREIT\b"
         r"|INFRASTRUCTURE|GREENKO|MUMBAI.*AIRPORT",
                                            "H-HardAssets", 0.90),
        (r"\bNVIDIA\b|\bTSMC\b|\bASML\b|\bBROADCOM\b|\bMICROSOFT\b"
         r"|\bALPHABET\b|\bAMD\b",         "A-AIpower",    0.90),
        (r"TREASURY|GOVT BOND|USTN|USTB|US T \d|GILTS|BUND",
                                            "L-LowVol",     0.90),
        (r"ARAMCO|SHELL|EXXON|CHEVRON|CNOOC|PETRO|OIL|ENERGY",
                                            "O-OilHedge",   0.90),
        # ── Bond types ───────────────────────────────────────────
        (r"TREASURY|USTN|USTB|US T \d",    "GovtBond-US",  1.00),
        (r"INDIA.*GOVERNMENT|INDIA GOVT",   "GovtBond-India", 1.00),
        (r"MALAYSIA.*GOVERNMENT|MALAYSIA GOVT",
                                            "GovtBond-EM",  0.90),
        (r"BRAZIL|INDONESIA.*BOND|MARSHALL ISLANDS",
                                            "GovtBond-EM",  0.85),
        (r"ISHARES.*EUR.*GOVT|ISHARES.*EURO.*CORP",
                                            "GovtBond-EU",  0.90),
        (r"ISHARES.*TREASURY|ISH.*TRES",    "GovtBond-US",  0.90),
        (r"ISHARES.*EM.*|ISHARES.*EMERGING", "GovtBond-EM",  0.80),
        (r"CORP.*BOND|CORPORATE.*BOND|CITIGROUP.*\d{4}|FOXCONN.*MTN",
                                            "CorpBond",     0.85),
        (r"ISHARES.*FLOAT|FLOATING RATE",   "FloatingRate", 0.90),
    ]
    _RULES.clear()
    for pattern, tag_name, conf in raw_rules:
        _RULES.append((re.compile(pattern, re.IGNORECASE), tag_name, conf))


_build_rules()


def tag_holdings_by_rules(
    holdings: list[str],
) -> list[TagRow]:
    """
    Apply compiled regex rules to each standardised holding name.
    Returns one TagRow per (holding, matched_tag) pair.
    """
    results: list[TagRow] = []
    for std_name in holdings:
        for pattern, tag_name, conf in _RULES:
            if pattern.search(std_name):
                tag_id = _resolve_tag_id(tag_name)
                if tag_id is not None:
                    results.append((std_name, tag_id, conf, "rule"))
    return results


# ─────────────────────────────────────────────────────────────────
# Backend 2: LLM tagger (placeholder)
# ─────────────────────────────────────────────────────────────────

def tag_holdings_by_llm(
    holdings: list[str],
    *,
    api_key: str | None = None,
    model: str = "qwen-plus",
) -> list[TagRow]:
    """
    Placeholder for LLM-based tagging.

    Replace the body of this function with your preferred LLM API call.
    Expected return: list of (holding_name_std, tag_id, confidence, 'llm')

    Example skeleton using Qwen / OpenAI-compatible endpoint:

        from openai import OpenAI
        client = OpenAI(api_key=api_key,
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
        prompt = build_tagging_prompt(holdings, list(_TAG_ID_CACHE.keys()))
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
        )
        raw_json = response.choices[0].message.content
        return parse_llm_response(raw_json)
    """
    log.info("LLM tagger called for %d holdings — placeholder, returning []", len(holdings))
    return []


# ─────────────────────────────────────────────────────────────────
# Backend 3: Manual overrides
# ─────────────────────────────────────────────────────────────────

def tag_holdings_manual(
    overrides: list[tuple[str, str, float]],
) -> list[TagRow]:
    """
    Accept a list of (holding_name_std, tag_name, confidence) tuples
    provided by the caller (e.g. from a corrections CSV or direct code).
    """
    results: list[TagRow] = []
    for std_name, tag_name, conf in overrides:
        tag_id = _resolve_tag_id(tag_name)
        if tag_id is None:
            log.warning("Unknown tag '%s' in manual override — skipping.", tag_name)
            continue
        results.append((std_name, tag_id, float(conf), "manual"))
    return results


# ─────────────────────────────────────────────────────────────────
# Merge + upsert
# ─────────────────────────────────────────────────────────────────

def _merge(rows: list[TagRow]) -> list[TagRow]:
    """
    When multiple backends tag the same (holding, tag) pair,
    keep the highest confidence score and the highest-priority source
    (manual > rule > llm).
    """
    SOURCE_PRIORITY = {"manual": 3, "rule": 2, "llm": 1}
    best: dict[tuple[str, int], TagRow] = {}
    for row in rows:
        key = (row[0], row[1])
        existing = best.get(key)
        if existing is None:
            best[key] = row
        else:
            # prefer higher confidence; break ties by source priority
            better_conf   = row[2] > existing[2]
            same_conf     = row[2] == existing[2]
            better_source = (SOURCE_PRIORITY.get(row[3], 0)
                             > SOURCE_PRIORITY.get(existing[3], 0))
            if better_conf or (same_conf and better_source):
                best[key] = row
    return list(best.values())


_UPSERT_SQL = """
    INSERT INTO holding_tag_map
        (holding_name_std, tag_id, confidence_score, source)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(holding_name_std, tag_id)
    DO UPDATE SET
        confidence_score = excluded.confidence_score,
        source           = excluded.source,
        tagged_at        = strftime('%Y-%m-%dT%H:%M:%fZ','now')
"""

def run_tagger(
    holdings: list[str],
    *,
    use_rules: bool = True,
    use_llm:   bool = False,
    llm_api_key: str | None = None,
    manual_overrides: list[tuple[str, str, float]] | None = None,
) -> int:
    """
    Run all active backends, merge results, upsert to holding_tag_map.
    Returns number of rows written.
    """
    _refresh_tag_cache()   # ensure cache reflects latest taxonomy
    all_rows: list[TagRow] = []

    if use_rules:
        all_rows += tag_holdings_by_rules(holdings)
    if use_llm:
        all_rows += tag_holdings_by_llm(holdings, api_key=llm_api_key)
    if manual_overrides:
        all_rows += tag_holdings_manual(manual_overrides)

    merged = _merge(all_rows)
    if not merged:
        log.info("No tag rows produced.")
        return 0

    conn = get_conn()
    try:
        conn.executemany(_UPSERT_SQL, merged)
        conn.commit()
        log.info("Upserted %d rows into holding_tag_map", len(merged))
        return len(merged)
    finally:
        conn.close()


# ── Backward compatibility (e.g. __init__ export) ─────────────────
def upsert_holding_tag_map(conn, rows: list[tuple]) -> int:
    """Insert or update rows into holding_tag_map. Each row: (holding_name_std, tag_id, confidence_score, source)."""
    if not rows:
        return 0
    conn.executemany(_UPSERT_SQL, rows)
    conn.commit()
    return len(rows)
