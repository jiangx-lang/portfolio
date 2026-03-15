-- ═══════════════════════════════════════════════════════════════
--  渣打 QDII 全球基金精选 · 数据库 Schema v1
--  基于实际 PDF 内容设计（qdur001/003/048/077）
--  SQLite 兼容（也可迁移至 PostgreSQL）
-- ═══════════════════════════════════════════════════════════════

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ───────────────────────────────────────────────────────────────
-- 1. 基金主表（每只境外基金一行，与渣打产品编号对应）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funds (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 文件识别
    source_file         TEXT NOT NULL,          -- 来源 PDF 文件名，如 cn-fs-qdur048.pdf
    parsed_at           TEXT,                   -- 解析时间 ISO8601

    -- 渣打产品编号（可多个，逗号分隔，如 QDUR048USD,QDUR048CNY）
    sc_product_codes    TEXT,
    -- 理财系统登记编码（逗号分隔）
    reg_codes           TEXT,
    -- 产品系列代号（QDUT / QDUR 等）
    series_prefix       TEXT,                   -- qdut / qdur
    fund_number         TEXT,                   -- 001 / 048 / 077

    -- 基金基本信息
    fund_name_cn        TEXT,                   -- 中文名：贝莱德全球基金－亚洲老虎债券基金
    fund_name_en        TEXT,                   -- 英文名（如有）
    fund_manager_company TEXT,                  -- 管理公司：贝莱德、富兰克林邓普顿等
    inception_date      TEXT,                   -- 成立日期
    base_currency       TEXT,                   -- 基本货币：USD/EUR/CNY/AUD
    available_currencies TEXT,                  -- 可用货币版本（逗号分隔）
    fund_aum_usd        REAL,                   -- 基金总值（百万美元）
    aum_date            TEXT,                   -- AUM 截至日期
    isin_codes          TEXT,                   -- ISIN 代码（JSON 或逗号分隔）
    bloomberg_codes     TEXT,                   -- 彭博代号

    -- 费用
    mgmt_fee_pct        REAL,                   -- 管理费（年费率 %）
    custody_fee_pct     REAL,                   -- 保管费（最高 %）
    admin_fee_pct       REAL,                   -- 行政费（最高 %）
    other_fees_note     TEXT,                   -- 其他费用说明

    -- 风险
    sc_risk_rating      TEXT,                   -- 渣打风险评级：风险规避型/保守型/稳健型/适度积极型/积极型/非常积极型
    annualized_std_3y   REAL,                   -- 年化标准差（3年）%
    avg_ytm             REAL,                   -- 平均到期殖利率 %（债券基金）
    avg_duration        REAL,                   -- 平均存续期间（年）（债券基金）

    -- 投资目标摘要
    investment_objective TEXT,                  -- 投资目标描述（原文）

    -- 数据来源说明
    data_source         TEXT,                   -- 资料来源：晨星、贝莱德等
    data_as_of          TEXT,                   -- 数据截至日期

    UNIQUE(source_file)
);

-- ───────────────────────────────────────────────────────────────
-- 2. 基金经理表（一只基金可有多个经理）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_managers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id     INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                  -- 姓名
    title       TEXT,                           -- 职称/头衔
    bio         TEXT,                           -- 简介
    UNIQUE(fund_id, name)
);

-- ───────────────────────────────────────────────────────────────
-- 3. 业绩表现（每次更新追加，保留历史）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_performance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    share_class     TEXT,                       -- A2美元 / A6美元稳定派息 / A8人民币对冲 等
    currency        TEXT,                       -- USD / CNY / EUR / AUD
    as_of_date      TEXT NOT NULL,              -- 数据截至日期

    -- 累积表现
    ret_3m          REAL,                       -- 3个月 %
    ret_6m          REAL,                       -- 6个月 %
    ret_ytd         REAL,                       -- 年初至今 %
    ret_1y          REAL,                       -- 1年 %
    ret_3y          REAL,                       -- 3年 %
    ret_5y          REAL,                       -- 5年 %
    ret_since_inception REAL,                   -- 成立至今 %

    -- 单年度表现
    ret_2025        REAL,
    ret_2024        REAL,
    ret_2023        REAL,
    ret_2022        REAL,
    ret_2021        REAL,
    ret_2020        REAL,
    ret_2019        REAL,
    ret_2018        REAL,
    ret_2017        REAL,
    ret_2016        REAL,
    ret_2015        REAL,
    ret_2014        REAL,
    ret_2013        REAL,

    -- 基准
    benchmark_name  TEXT,
    bench_ret_3m    REAL,
    bench_ret_1y    REAL,
    bench_ret_3y    REAL,
    bench_ret_5y    REAL,
    bench_ret_since_inception REAL,

    -- 最新净值
    nav             REAL,                       -- 最新单位净值
    nav_currency    TEXT,

    UNIQUE(fund_id, share_class, as_of_date)
);

-- ───────────────────────────────────────────────────────────────
-- 4. 派息记录
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dividend_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    sc_product_code TEXT,                       -- QDUR048USD / QDUR048CNY
    share_class     TEXT,
    currency        TEXT,
    record_date     TEXT,                       -- 记录日
    ex_div_date     TEXT,                       -- 除息日
    dividend_per_share REAL,                   -- 每股股息
    nav_on_ex_date  REAL,                       -- 除息日单位净值
    annualized_yield_pct REAL,                 -- 股息率（年化）%
    UNIQUE(fund_id, sc_product_code, ex_div_date)
);

-- ───────────────────────────────────────────────────────────────
-- 5. 十大持仓
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS top_holdings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date      TEXT,
    rank            INTEGER,                    -- 排名 1-10
    holding_name    TEXT NOT NULL,              -- 持股/债券名称
    holding_type    TEXT,                       -- equity / bond / cash / other
    weight_pct      REAL,                       -- 比重 %
    UNIQUE(fund_id, as_of_date, rank)
);

-- ───────────────────────────────────────────────────────────────
-- 6. 地区分布
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regional_allocation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date      TEXT,
    region          TEXT NOT NULL,              -- 中国 / 美国 / 印度 / 香港 等
    weight_pct      REAL,
    UNIQUE(fund_id, as_of_date, region)
);

-- ───────────────────────────────────────────────────────────────
-- 7. 行业分布
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sector_allocation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date      TEXT,
    sector          TEXT NOT NULL,              -- 信息科技 / 金融 / 能源 等
    weight_pct      REAL,
    UNIQUE(fund_id, as_of_date, sector)
);

-- ───────────────────────────────────────────────────────────────
-- 8. 资产类别分布（股票/固定收益/现金/大宗商品）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_class_allocation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date      TEXT,
    asset_class     TEXT NOT NULL,              -- 股票 / 固定收益 / 现金 / 大宗商品
    weight_pct      REAL,
    UNIQUE(fund_id, as_of_date, asset_class)
);

-- ───────────────────────────────────────────────────────────────
-- 9. 债券信用评级分布（债券基金专用）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_rating_allocation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id         INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date      TEXT,
    rating          TEXT NOT NULL,              -- AAA / AA / A / BBB / BB / B / CCC / 未评级
    weight_pct      REAL,
    UNIQUE(fund_id, as_of_date, rating)
);

-- ───────────────────────────────────────────────────────────────
-- 10. 解析日志（追踪每次更新，便于调试）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parse_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file     TEXT,
    parsed_at       TEXT,
    status          TEXT,                       -- success / partial / failed
    fields_found    TEXT,                       -- JSON：找到的字段列表
    fields_missing  TEXT,                       -- JSON：未找到的字段列表
    unknown_terms   TEXT,                       -- JSON：遇到的新术语，待人工确认
    error_msg       TEXT
);

-- ───────────────────────────────────────────────────────────────
-- 11. 待确认新字段表（扫描遇到未知 term 时写入，等你确认）
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_new_fields (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file     TEXT,
    term_found      TEXT,                       -- 发现的新字段名
    sample_value    TEXT,                       -- 样本值
    suggested_table TEXT,                       -- 建议加到哪张表
    suggested_col   TEXT,                       -- 建议列名
    confirmed       INTEGER DEFAULT 0,          -- 0=待确认 1=已确认 2=已忽略
    created_at      TEXT
);

-- ───────────────────────────────────────────────────────────────
-- 常用查询视图
-- ───────────────────────────────────────────────────────────────

-- 基金概览（最新数据）
CREATE VIEW IF NOT EXISTS v_fund_overview AS
SELECT
    f.fund_number,
    f.fund_name_cn,
    f.fund_manager_company,
    f.sc_risk_rating,
    f.sc_product_codes,
    f.fund_aum_usd,
    f.aum_date,
    f.mgmt_fee_pct,
    f.annualized_std_3y,
    f.avg_ytm,
    f.avg_duration,
    f.base_currency,
    f.source_file
FROM funds f;

-- 最新业绩
CREATE VIEW IF NOT EXISTS v_latest_performance AS
SELECT
    f.fund_name_cn,
    f.sc_risk_rating,
    p.share_class,
    p.currency,
    p.as_of_date,
    p.ret_ytd,
    p.ret_1y,
    p.ret_3y,
    p.ret_5y,
    p.nav
FROM fund_performance p
JOIN funds f ON f.id = p.fund_id;

-- 最新十大持仓
CREATE VIEW IF NOT EXISTS v_top_holdings AS
SELECT
    f.fund_name_cn,
    h.as_of_date,
    h.rank,
    h.holding_name,
    h.holding_type,
    h.weight_pct
FROM top_holdings h
JOIN funds f ON f.id = h.fund_id
ORDER BY f.fund_name_cn, h.rank;
