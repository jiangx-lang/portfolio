-- fund_tagging/schema.sql
-- SQLite-compatible. For PostgreSQL: replace TEXT (JSON) with JSONB.
-- Run once to initialise the database.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────
-- 1. Tag taxonomy
--    Hierarchical tag registry.  parent_tag_id enables sub-themes,
--    e.g.  AI > AI-Chips,  AI > AI-SaaS.
--    aliases is a JSON array of alternative names used at search time.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_taxonomy (
    tag_id        INTEGER  PRIMARY KEY AUTOINCREMENT,
    tag_name      TEXT     NOT NULL UNIQUE,
    category      TEXT     NOT NULL
                  CHECK (category IN
                    ('region','sector','theme','style','custom','asset_class')),
    parent_tag_id INTEGER  REFERENCES tag_taxonomy(tag_id)
                           ON DELETE SET NULL,
    aliases       TEXT     NOT NULL DEFAULT '[]',   -- JSON array of strings
    description   TEXT,
    is_active     INTEGER  NOT NULL DEFAULT 1,
    created_at    TEXT     NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS ix_tag_taxonomy_category
    ON tag_taxonomy(category);

-- ─────────────────────────────────────────────────────────────────
-- 2. Holding → tag mapping
--    One row per (standardised holding name, tag).
--    source values: 'rule' | 'llm' | 'manual' | 'seed'
--    confidence_score: 0.0 – 1.0
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holding_tag_map (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    holding_name_std  TEXT     NOT NULL,
    tag_id            INTEGER  NOT NULL
                      REFERENCES tag_taxonomy(tag_id) ON DELETE CASCADE,
    confidence_score  REAL     NOT NULL DEFAULT 1.0
                      CHECK (confidence_score >= 0.0
                         AND confidence_score <= 1.0),
    source            TEXT     NOT NULL DEFAULT 'rule'
                      CHECK (source IN ('rule','llm','manual','seed')),
    tagged_at         TEXT     NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (holding_name_std, tag_id)
);

CREATE INDEX IF NOT EXISTS ix_htmap_holding
    ON holding_tag_map(holding_name_std);
CREATE INDEX IF NOT EXISTS ix_htmap_tag
    ON holding_tag_map(tag_id);

-- ─────────────────────────────────────────────────────────────────
-- 3. Fund → holding exposure
--    One row per fund × holding × date.
--    holding_name_std links to holding_tag_map.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_holding_exposure (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    fund_id           INTEGER  NOT NULL,
    holding_name_std  TEXT     NOT NULL,
    holding_name_raw  TEXT,                  -- original name before standardisation
    holding_type      TEXT     CHECK (holding_type IN
                                ('equity','bond','cash','etf','other')),
    weight_pct        REAL     NOT NULL
                      CHECK (weight_pct >= 0),
    rank              INTEGER,
    as_of_date        TEXT     NOT NULL,     -- ISO-8601 date string
    UNIQUE (fund_id, holding_name_std, as_of_date)
);

CREATE INDEX IF NOT EXISTS ix_fhe_fund
    ON fund_holding_exposure(fund_id, as_of_date);
CREATE INDEX IF NOT EXISTS ix_fhe_holding
    ON fund_holding_exposure(holding_name_std);

-- ─────────────────────────────────────────────────────────────────
-- 4. Fund → tag aggregation (materialised result)
--    aggregated_score = SUM(weight_pct * confidence_score)
--    explanation is a JSON object mapping holding_name_std → contribution
--    e.g. {"NVIDIA": 8.5, "MICROSOFT": 4.2}
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_tag_map (
    id               INTEGER  PRIMARY KEY AUTOINCREMENT,
    fund_id          INTEGER  NOT NULL,
    tag_id           INTEGER  NOT NULL
                     REFERENCES tag_taxonomy(tag_id) ON DELETE CASCADE,
    aggregated_score REAL     NOT NULL DEFAULT 0.0,
    explanation      TEXT     NOT NULL DEFAULT '{}',  -- JSON
    calculated_at    TEXT     NOT NULL
                     DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (fund_id, tag_id)
);

CREATE INDEX IF NOT EXISTS ix_ftmap_fund
    ON fund_tag_map(fund_id);
CREATE INDEX IF NOT EXISTS ix_ftmap_tag_score
    ON fund_tag_map(tag_id, aggregated_score DESC);
