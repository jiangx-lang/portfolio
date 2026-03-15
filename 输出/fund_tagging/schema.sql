-- Bottom-up fund tagging schema (SQLite / PostgreSQL compatible)
-- For PostgreSQL: replace TEXT for JSON fields with JSONB if desired.

-- 1. Tag taxonomy: hierarchical tags (region/sector/theme/style/custom)
CREATE TABLE IF NOT EXISTS tag_taxonomy (
    tag_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name       TEXT NOT NULL UNIQUE,
    category       TEXT NOT NULL CHECK (category IN ('region','sector','theme','style','custom')),
    parent_tag_id  INTEGER REFERENCES tag_taxonomy(tag_id),
    aliases        TEXT,  -- JSON array of alternate names, e.g. ["US","United States"]
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tag_taxonomy_category ON tag_taxonomy(category);
CREATE INDEX IF NOT EXISTS idx_tag_taxonomy_parent ON tag_taxonomy(parent_tag_id);

-- 2. Holding-level tags: one row per (holding_name_std, tag_id); multi-label with confidence
CREATE TABLE IF NOT EXISTS holding_tag_map (
    holding_name_std  TEXT NOT NULL,
    tag_id            INTEGER NOT NULL REFERENCES tag_taxonomy(tag_id) ON DELETE CASCADE,
    confidence_score  REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    source            TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
    created_at        TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (holding_name_std, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_holding_tag_map_tag ON holding_tag_map(tag_id);

-- 3. Fund exposure to holdings (from top_holdings_detail.csv); one row per fund/holding/date
CREATE TABLE IF NOT EXISTS fund_holding_exposure (
    fund_id          INTEGER NOT NULL,
    holding_name_std TEXT NOT NULL,
    weight_pct       REAL NOT NULL,
    rank             INTEGER,
    as_of_date       TEXT,
    PRIMARY KEY (fund_id, holding_name_std, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_fund_holding_exposure_fund ON fund_holding_exposure(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_holding_exposure_holding ON fund_holding_exposure(holding_name_std);

-- 4. Aggregated fund-level tags (computed bottom-up); explanation = JSON { holding_name: contribution_pct }
CREATE TABLE IF NOT EXISTS fund_tag_map (
    fund_id           INTEGER NOT NULL,
    tag_id            INTEGER NOT NULL REFERENCES tag_taxonomy(tag_id) ON DELETE CASCADE,
    aggregated_score  REAL NOT NULL,
    explanation       TEXT,  -- JSON object: {"NVIDIA": 8.5, "TSMC": 4.2}
    as_of_date        TEXT,  -- snapshot date for exposure used
    updated_at        TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (fund_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_fund_tag_map_tag ON fund_tag_map(tag_id);
CREATE INDEX IF NOT EXISTS idx_fund_tag_map_fund ON fund_tag_map(fund_id);
