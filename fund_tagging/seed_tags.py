"""
Seed the tag_taxonomy with a comprehensive initial set of tags,
then seed holding_tag_map with example mappings to verify the pipeline.

Designed to be idempotent — safe to run multiple times.
"""

import json
import logging
from .db import get_conn

log = logging.getLogger(__name__)

# ── Tag taxonomy seed data ────────────────────────────────────────
# (tag_name, category, parent_name_or_None, aliases_list, description)
TAXONOMY_SEED: list[tuple[str, str, str | None, list[str], str]] = [

    # ── Regions ──────────────────────────────────────────────────
    ("US",         "region", None,  ["United States", "America", "美国"],  "United States exposure"),
    ("China",      "region", None,  ["中国", "PRC", "Mainland China"],      "China mainland exposure"),
    ("Taiwan",     "region", None,  ["台湾", "ROC"],                        "Taiwan exposure"),
    ("Korea",      "region", None,  ["韩国", "South Korea"],                "South Korea exposure"),
    ("Japan",      "region", None,  ["日本"],                               "Japan exposure"),
    ("India",      "region", None,  ["印度"],                               "India exposure"),
    ("Asia",       "region", None,  ["亚洲", "Pan-Asia"],                   "Broad Asia exposure"),
    ("Europe",     "region", None,  ["欧洲"],                               "Europe exposure"),
    ("EM",         "region", None,  ["Emerging Markets", "新兴市场"],        "Broad emerging markets"),
    ("LatAm",      "region", None,  ["Latin America", "拉丁美洲"],           "Latin America exposure"),
    ("MiddleEast", "region", None,  ["中东", "MENA"],                       "Middle East & North Africa"),

    # ── Sectors ──────────────────────────────────────────────────
    ("Technology",     "sector", None, ["科技", "Tech"],          "Technology sector"),
    ("Semiconductors", "sector", "Technology", ["芯片", "Chips"], "Semiconductor sub-sector"),
    ("Financials",     "sector", None, ["金融"],                  "Financial sector"),
    ("Healthcare",     "sector", None, ["医疗", "Pharma"],        "Healthcare & pharma"),
    ("Energy",         "sector", None, ["能源"],                  "Energy sector"),
    ("Infrastructure", "sector", None, ["基础设施"],              "Infrastructure"),
    ("Real Estate",    "sector", None, ["房地产", "REITs"],        "Real estate & REITs"),
    ("ConsumerStaples","sector", None, ["必需消费品"],             "Consumer staples"),
    ("ConsumerDisc",   "sector", None, ["可选消费品"],             "Consumer discretionary"),
    ("Industrials",    "sector", None, ["工业"],                  "Industrials"),
    ("Materials",      "sector", None, ["材料"],                  "Materials"),
    ("Utilities",      "sector", None, ["公用事业"],              "Utilities"),
    ("Telecom",        "sector", None, ["电信", "通信"],          "Telecommunications"),

    # ── Themes ───────────────────────────────────────────────────
    ("AI",         "theme", None,  ["Artificial Intelligence", "人工智能"],  "AI broad theme"),
    ("SaaS",       "theme", "AI",  ["Cloud Software", "云软件"],             "Software-as-a-service"),
    ("AIChips",    "theme", "AI",  ["AI Semiconductors", "AI芯片"],          "AI chip manufacturers"),
    ("DataCenter", "theme", "AI",  ["数据中心"],                             "Data centre infrastructure"),
    ("CleanEnergy","theme", None,  ["Green Energy", "清洁能源"],             "Clean / renewable energy"),
    ("EV",         "theme", None,  ["Electric Vehicle", "电动车"],           "Electric vehicles"),
    ("Cybersecurity","theme",None, ["网络安全"],                             "Cybersecurity"),
    ("Biotech",    "theme", None,  ["生物科技"],                             "Biotechnology"),
    ("HighDividend","theme",None,  ["高股息", "Dividend"],                   "High dividend payers"),

    # ── Bond types (reuse 'theme' category) ──────────────────────
    ("GovtBond-US","theme", None,  ["US Treasury", "美国国债"],             "US government bonds"),
    ("GovtBond-EU","theme", None,  ["European Govt Bond", "欧洲国债"],      "European government bonds"),
    ("GovtBond-EM","theme", None,  ["EM Sovereign", "新兴市场国债"],        "EM sovereign bonds"),
    ("CorpBond",   "theme", None,  ["Corporate Bond", "企业债"],            "Investment-grade corp bonds"),
    ("HYBond",     "theme", None,  ["High Yield", "高收益债"],              "High-yield / sub-IG bonds"),
    ("FloatingRate","theme",None,  ["浮动利率"],                            "Floating-rate instruments"),

    # ── Styles ───────────────────────────────────────────────────
    ("Growth",     "style", None,  ["成长", "High Growth"],                 "Growth style"),
    ("Value",      "style", None,  ["价值"],                                "Value style"),
    ("LowVol",     "style", None,  ["Low Volatility", "低波动", "Defensive"],"Low-volatility / defensive"),
    ("Income",     "style", None,  ["收益", "Yield"],                       "Income-oriented"),
    ("Momentum",   "style", None,  ["动量"],                                "Momentum style"),

    # ── Custom / HALO ─────────────────────────────────────────────
    ("H-HardAssets","custom",None, ["Hard Assets", "硬资产", "H"],          "HALO: Hard assets"),
    ("A-AIpower",   "custom",None, ["AI Power", "A"],                       "HALO: AI power demand"),
    ("L-LowVol",    "custom",None, ["Low Volatility Cash Flow", "L"],       "HALO: Low volatility"),
    ("O-OilHedge",  "custom",None, ["Oil & Geo Hedge", "O"],                "HALO: Oil & geopolitical"),
]


def seed_taxonomy() -> int:
    """Insert taxonomy rows. Returns number of new rows inserted."""
    # First pass: insert without parent_tag_id (resolve parents in second pass)
    name_to_id: dict[str, int] = {}
    inserted = 0

    conn = get_conn()
    try:
        for tag_name, category, parent_name, aliases, description in TAXONOMY_SEED:
            aliases_json = json.dumps(aliases, ensure_ascii=False)
            try:
                cur = conn.execute("""
                    INSERT INTO tag_taxonomy
                        (tag_name, category, aliases, description)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(tag_name) DO NOTHING
                """, (tag_name, category, aliases_json, description))
                if cur.rowcount:
                    inserted += 1
            except Exception as exc:
                log.warning("Could not insert tag '%s': %s", tag_name, exc)

        # Populate name→id map
        for row in conn.execute("SELECT tag_id, tag_name FROM tag_taxonomy"):
            name_to_id[row["tag_name"]] = row["tag_id"]

        # Second pass: set parent_tag_id
        for tag_name, _, parent_name, _, _ in TAXONOMY_SEED:
            if parent_name and parent_name in name_to_id:
                conn.execute("""
                    UPDATE tag_taxonomy
                    SET parent_tag_id = ?
                    WHERE tag_name = ? AND parent_tag_id IS NULL
                """, (name_to_id[parent_name], tag_name))

        conn.commit()
        log.info("Taxonomy seed: %d new tags inserted", inserted)
        return inserted
    finally:
        conn.close()


# ── Example holding → tag seeds ───────────────────────────────────
# These are written to holding_tag_map directly (source='manual').
# Extend this list; run_tagger will not overwrite manual entries unless
# you explicitly pass a manual_overrides list.

HOLDING_SEED: list[tuple[str, str, float]] = [
    # (holding_name_std, tag_name, confidence)
    ("NVIDIA",                  "AI",           1.00),
    ("NVIDIA",                  "AIChips",      1.00),
    ("NVIDIA",                  "Technology",   1.00),
    ("NVIDIA",                  "Semiconductors",1.00),
    ("NVIDIA",                  "US",           1.00),
    ("NVIDIA",                  "A-AIpower",    1.00),
    ("TAIWAN SEMICONDUCTOR",    "AI",           0.95),
    ("TAIWAN SEMICONDUCTOR",    "AIChips",      0.95),
    ("TAIWAN SEMICONDUCTOR",    "Semiconductors",1.00),
    ("TAIWAN SEMICONDUCTOR",    "Taiwan",       1.00),
    ("TAIWAN SEMICONDUCTOR",    "A-AIpower",    0.90),
    ("MICROSOFT",               "AI",           0.85),
    ("MICROSOFT",               "SaaS",         0.90),
    ("MICROSOFT",               "Technology",   1.00),
    ("MICROSOFT",               "US",           1.00),
    ("MICROSOFT",               "A-AIpower",    0.80),
    ("ALPHABET",                "AI",           0.85),
    ("ALPHABET",                "Technology",   1.00),
    ("ALPHABET",                "US",           1.00),
    ("AMAZON",                  "AI",           0.75),
    ("AMAZON",                  "SaaS",         0.75),
    ("AMAZON",                  "US",           1.00),
    ("APPLE",                   "Technology",   1.00),
    ("APPLE",                   "US",           1.00),
    ("BROADCOM",                "AI",           0.85),
    ("BROADCOM",                "Semiconductors",0.95),
    ("BROADCOM",                "US",           1.00),
    ("ASML",                    "AI",           0.90),
    ("ASML",                    "Semiconductors",1.00),
    ("ASML",                    "Europe",       1.00),
    ("AMD",                     "AI",           0.90),
    ("AMD",                     "Semiconductors",1.00),
    ("AMD",                     "US",           1.00),
    ("SAMSUNG ELECTRONICS",     "Technology",   0.90),
    ("SAMSUNG ELECTRONICS",     "Semiconductors",0.90),
    ("SAMSUNG ELECTRONICS",     "Korea",        1.00),
    ("SK HYNIX",                "AI",           0.80),
    ("SK HYNIX",                "Semiconductors",0.90),
    ("SK HYNIX",                "Korea",        1.00),
    ("TENCENT",                 "Technology",   0.85),
    ("TENCENT",                 "China",        1.00),
    ("ALIBABA",                 "Technology",   0.80),
    ("ALIBABA",                 "China",        1.00),
    ("HDFC",                    "Financials",   0.90),
    ("HDFC",                    "India",        1.00),
    ("RELIANCE",                "Energy",       0.70),
    ("RELIANCE",                "India",        1.00),
    ("CATL",                    "EV",           1.00),
    ("CATL",                    "China",        1.00),
    ("ASTRAZENECA",             "Healthcare",   1.00),
    ("ASTRAZENECA",             "Europe",       1.00),
    ("NOVO NORDISK",            "Healthcare",   1.00),
    ("NOVO NORDISK",            "Europe",       1.00),
    ("PING AN INSURANCE",       "Financials",   0.90),
    ("PING AN INSURANCE",       "China",        1.00),
    ("SCHNEIDER ELECTRIC",      "Industrials",  0.90),
    ("SCHNEIDER ELECTRIC",      "Europe",       1.00),
    ("ARAMCO",                  "Energy",       1.00),
    ("ARAMCO",                  "MiddleEast",   1.00),
    ("ARAMCO",                  "O-OilHedge",   1.00),
]


def seed_example_holding_tags() -> int:
    """
    Upsert HOLDING_SEED into holding_tag_map.
    Returns number of rows written.
    """
    from .holding_tagger import run_tagger
    n = run_tagger(
        holdings=[],          # rules won't run (empty list)
        use_rules=False,
        manual_overrides=HOLDING_SEED,
    )
    log.info("Holding seed: %d rows written to holding_tag_map", n)
    return n
