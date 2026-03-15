"""
48个标签分类 + 60条示例持仓映射. Idempotent.
"""
from .db import get_connection, init_schema


def seed_taxonomy(conn) -> None:
    """Insert 48 tags (regions, sectors, themes, styles, custom). Skip if already present."""
    n = conn.execute("SELECT COUNT(*) FROM tag_taxonomy").fetchone()[0]
    if n >= 48:
        return
    if n > 0:
        return
    rows = [
        # region (12)
        ("US", "region", None, '["United States","USA"]'),
        ("Europe", "region", None, '["EU","Eurozone"]'),
        ("Asia", "region", None, '["APAC","Asia Pacific"]'),
        ("Japan", "region", None, '["JP"]'),
        ("China", "region", None, '["CN","Greater China"]'),
        ("UK", "region", None, '["United Kingdom"]'),
        ("Emerging Markets", "region", None, '["EM"]'),
        ("Latin America", "region", None, None),
        ("Middle East", "region", None, None),
        ("Pacific ex Japan", "region", None, None),
        ("Global", "region", None, None),
        ("Hong Kong", "region", None, '["HK"]'),
        # sector (14)
        ("Technology", "sector", None, '["Tech","IT"]'),
        ("Financials", "sector", None, '["Financial","Finance"]'),
        ("Healthcare", "sector", None, '["Health"]'),
        ("Consumer Discretionary", "sector", None, None),
        ("Consumer Staples", "sector", None, None),
        ("Industrials", "sector", None, None),
        ("Energy", "sector", None, None),
        ("Materials", "sector", None, None),
        ("Real Estate", "sector", None, None),
        ("Communication Services", "sector", None, None),
        ("Utilities", "sector", None, None),
        ("Semiconductors", "sector", None, None),
        ("Software", "sector", None, None),
        ("Biotech", "sector", None, None),
        # theme (10)
        ("AI", "theme", None, '["Artificial Intelligence"]'),
        ("SaaS", "theme", None, '["Software as a Service"]'),
        ("Clean Energy", "theme", None, None),
        ("Cybersecurity", "theme", None, None),
        ("Fintech", "theme", None, None),
        ("E-commerce", "theme", None, None),
        ("Cloud", "theme", None, None),
        ("EV", "theme", None, '["Electric Vehicle"]'),
        ("ESG", "theme", None, None),
        ("Dividend", "theme", None, None),
        # style (6)
        ("Value", "style", None, '["Value Investing"]'),
        ("Growth", "style", None, None),
        ("Quality", "style", None, None),
        ("Momentum", "style", None, None),
        ("Low Volatility", "style", None, None),
        ("Size", "style", None, None),
        # custom (6)
        ("halo", "custom", None, None),
        ("Core", "custom", None, None),
        ("Satellite", "custom", None, None),
        ("Defensive", "custom", None, None),
        ("Aggressive", "custom", None, None),
        ("Balanced", "custom", None, None),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO tag_taxonomy (tag_name, category, parent_tag_id, aliases)
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )
    conn.commit()


def seed_example_holding_tags(conn) -> int:
    """60条示例 (holding_name_std, tag_name, confidence, source). Returns count inserted."""
    cursor = conn.execute("SELECT tag_id, tag_name FROM tag_taxonomy")
    tag_by_name = {row[1]: row[0] for row in cursor.fetchall()}
    examples = [
        ("NVIDIA", "AI", 0.95, "rule"),
        ("NVIDIA", "Technology", 1.0, "rule"),
        ("MICROSOFT", "Technology", 1.0, "rule"),
        ("MICROSOFT", "AI", 0.7, "rule"),
        ("ALPHABET", "Technology", 1.0, "rule"),
        ("ALPHABET", "AI", 0.6, "rule"),
        ("APPLE", "Technology", 1.0, "rule"),
        ("TAIWAN SEMICONDUCTOR", "Technology", 1.0, "rule"),
        ("TAIWAN SEMICONDUCTOR", "AI", 0.6, "rule"),
        ("BROADCOM", "Technology", 1.0, "rule"),
        ("BROADCOM", "Semiconductors", 0.95, "rule"),
        ("TENCENT", "Technology", 0.9, "rule"),
        ("ALIBABA", "Technology", 0.8, "rule"),
        ("AMAZON", "Technology", 0.9, "rule"),
        ("META", "Technology", 0.95, "rule"),
        ("ORACLE", "Technology", 0.9, "rule"),
        ("ORACLE", "Software", 0.95, "rule"),
        ("ADOBE", "Software", 0.95, "rule"),
        ("SALESFORCE", "SaaS", 0.95, "rule"),
        ("SNOWFLAKE", "SaaS", 0.9, "rule"),
        ("NESTLE", "Consumer Staples", 0.95, "rule"),
        ("JOHNSON & JOHNSON", "Healthcare", 0.9, "rule"),
        ("UNILEVER", "Consumer Staples", 0.9, "rule"),
        ("PROCTER & GAMBLE", "Consumer Staples", 0.9, "rule"),
        ("VISA", "Financials", 0.95, "rule"),
        ("VISA", "Fintech", 0.7, "rule"),
        ("MASTERCARD", "Financials", 0.95, "rule"),
        ("JPMORGAN", "Financials", 0.95, "rule"),
        ("BANK OF AMERICA", "Financials", 0.95, "rule"),
        ("WELLS FARGO", "Financials", 0.9, "rule"),
        ("HSBC", "Financials", 0.9, "rule"),
        ("MCDONALDS", "Consumer Discretionary", 0.85, "rule"),
        ("TESLA", "EV", 0.95, "rule"),
        ("TESLA", "Technology", 0.8, "rule"),
        ("CHEVRON", "Energy", 0.95, "rule"),
        ("EXXON MOBIL", "Energy", 0.95, "rule"),
        ("SHELL", "Energy", 0.9, "rule"),
        ("BHP", "Materials", 0.9, "rule"),
        ("RIO TINTO", "Materials", 0.9, "rule"),
        ("GLENCORE", "Materials", 0.85, "rule"),
        ("BARRICK GOLD", "Materials", 0.85, "rule"),
        ("NEWMONT", "Materials", 0.85, "rule"),
        ("NETFLIX", "Communication Services", 0.95, "rule"),
        ("DISNEY", "Communication Services", 0.9, "rule"),
        ("COCA-COLA", "Consumer Staples", 0.95, "rule"),
        ("PEPSICO", "Consumer Staples", 0.9, "rule"),
        ("PHILIP MORRIS", "Consumer Staples", 0.85, "rule"),
        ("LVMH", "Consumer Discretionary", 0.95, "rule"),
        ("SAMSUNG", "Technology", 0.95, "rule"),
        ("SAMSUNG", "Semiconductors", 0.8, "rule"),
        ("SONY", "Technology", 0.85, "rule"),
        ("TOYOTA", "Consumer Discretionary", 0.9, "rule"),
        ("HONDA", "Consumer Discretionary", 0.85, "rule"),
        ("SIEMENS", "Industrials", 0.9, "rule"),
        ("GENERAL ELECTRIC", "Industrials", 0.85, "rule"),
        ("3M", "Industrials", 0.85, "rule"),
        ("UNITEDHEALTH", "Healthcare", 0.95, "rule"),
        ("PFIZER", "Healthcare", 0.95, "rule"),
        ("MERCK", "Healthcare", 0.9, "rule"),
        ("ABBVIE", "Healthcare", 0.9, "rule"),
        ("ISHARES $ FLOATING RATE BD UCITS ETF USD", "Financials", 0.5, "rule"),
    ]
    rows = []
    for holding, tag_name, conf, src in examples:
        tid = tag_by_name.get(tag_name)
        if tid is not None and conf > 0:
            rows.append((holding, tid, conf, src))
    if not rows:
        return 0
    conn.executemany(
        """
        INSERT INTO holding_tag_map (holding_name_std, tag_id, confidence_score, source)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET confidence_score = excluded.confidence_score
        """,
        rows,
    )
    conn.commit()
    return len(rows)
