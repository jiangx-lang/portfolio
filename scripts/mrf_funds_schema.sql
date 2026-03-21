-- MRF 基金池表（Supabase）
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本创建表并插入种子数据

-- 建表
CREATE TABLE IF NOT EXISTS mrf_funds (
    fund_name    TEXT PRIMARY KEY,
    brand        TEXT NOT NULL DEFAULT '',
    sc_product_code TEXT,                 -- 产品代码（如 968013；可为空）
    equity_pct   INTEGER NOT NULL DEFAULT 0,   -- 股票
    fixed_income_pct INTEGER NOT NULL DEFAULT 0,  -- 固定收益
    cash_pct    INTEGER NOT NULL DEFAULT 0,    -- 现金
    fee_rate    REAL NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mrf_funds ADD COLUMN IF NOT EXISTS sc_product_code TEXT;

-- RLS：允许匿名读（与 nav_history 一致，key 不暴露敏感数据时可开）
ALTER TABLE mrf_funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrf_funds_read" ON mrf_funds;
CREATE POLICY "mrf_funds_read" ON mrf_funds FOR SELECT USING (true);

-- 种子数据（与 app.py MRF_POOL 一致）
INSERT INTO mrf_funds (fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate) VALUES
    ('东方汇理香港组合-灵活配置增长', 'Amundi', 70, 25, 5, 3.0),
    ('东方汇理香港组合-灵活配置均衡', 'Amundi', 50, 45, 5, 3.0),
    ('东方汇理香港组合-灵活配置平稳', 'Amundi', 30, 60, 10, 3.0),
    ('东亚联丰环球股票基金', 'BEA', 95, 0, 5, 2.5),
    ('东亚联丰亚洲债券及货币基金', 'BEA', 0, 95, 5, 2.0),
    ('惠理高息股票基金', 'ValuePartners', 95, 0, 5, 2.5),
    ('惠理价值基金', 'ValuePartners', 95, 0, 5, 2.5),
    ('摩根国际债', 'JPM', 0, 95, 5, 2.0),
    ('摩根太平洋科技', 'JPM', 95, 0, 5, 2.5),
    ('摩根太平洋证券', 'JPM', 95, 0, 5, 1.5),
    ('摩根亚洲股息', 'JPM', 95, 0, 5, 2.5),
    ('摩根亚洲总收益', 'JPM', 50, 45, 5, 1.0),
    ('瑞士百达策略收益基金', 'Pictet', 40, 50, 10, 3.0),
    ('中银香港环球股票基金', 'BOC', 95, 0, 5, 1.5),
    ('中银香港香港股票基金', 'BOC', 95, 0, 5, 1.5),
    ('施罗德亚洲高息股债基金M类别(人民币派息)', 'Schroders', 64, 23, 13, 2.0)
ON CONFLICT (fund_name) DO UPDATE SET
    brand = excluded.brand,
    equity_pct = excluded.equity_pct,
    fixed_income_pct = excluded.fixed_income_pct,
    cash_pct = excluded.cash_pct,
    fee_rate = excluded.fee_rate,
    updated_at = now();
