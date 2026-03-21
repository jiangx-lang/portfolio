-- ============================================================
-- 1. 建表：mrf_funds
-- 在 Supabase SQL Editor 里执行此文件
-- ============================================================
CREATE TABLE IF NOT EXISTS mrf_funds (
  fund_name       TEXT PRIMARY KEY,          -- 基金名称（中文）
  brand           TEXT NOT NULL,             -- 品牌：Amundi / BEA / JPM 等
  sc_product_code TEXT,                      -- 产品代码（如 968013；可为空）
  equity_pct      INTEGER NOT NULL DEFAULT 0,       -- 股票%
  fixed_income_pct INTEGER NOT NULL DEFAULT 0,      -- 固定收益%
  cash_pct        INTEGER NOT NULL DEFAULT 5,       -- 现金%
  fee_rate        NUMERIC(4,2) NOT NULL DEFAULT 0,  -- 申购费率（百分点，如 3.0 = 3%）
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 若表已存在但缺列，补齐 sc_product_code
ALTER TABLE mrf_funds ADD COLUMN IF NOT EXISTS sc_product_code TEXT;

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mrf_funds_updated_at ON mrf_funds;
CREATE TRIGGER mrf_funds_updated_at
  BEFORE UPDATE ON mrf_funds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS：允许 anon 读取（Next.js / Streamlit 用 anon key 读）
ALTER TABLE mrf_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read" ON mrf_funds FOR SELECT USING (true);

-- ============================================================
-- 2. 种子数据：16 条 MRF_POOL（对应 app.py 硬编码）
-- ============================================================
INSERT INTO mrf_funds (fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate) VALUES
  ('东方汇理香港组合-灵活配置增长',              'Amundi',       70, 25,  5,  3.0),
  ('东方汇理香港组合-灵活配置均衡',              'Amundi',       50, 45,  5,  3.0),
  ('东方汇理香港组合-灵活配置平稳',              'Amundi',       30, 60, 10,  3.0),
  ('东亚联丰环球股票基金',                       'BEA',          95,  0,  5,  2.5),
  ('东亚联丰亚洲债券及货币基金',                 'BEA',           0, 95,  5,  2.0),
  ('惠理高息股票基金',                           'ValuePartners', 95,  0,  5,  2.5),
  ('惠理价值基金',                               'ValuePartners', 95,  0,  5,  2.5),
  ('摩根国际债',                                 'JPM',           0, 95,  5,  2.0),
  ('摩根太平洋科技',                             'JPM',          95,  0,  5,  2.5),
  ('摩根太平洋证券',                             'JPM',          95,  0,  5,  1.5),
  ('摩根亚洲股息',                               'JPM',          95,  0,  5,  2.5),
  ('摩根亚洲总收益',                             'JPM',          50, 45,  5,  1.0),
  ('瑞士百达策略收益基金',                       'Pictet',       40, 50, 10,  3.0),
  ('中银香港环球股票基金',                       'BOC',          95,  0,  5,  1.5),
  ('中银香港香港股票基金',                       'BOC',          95,  0,  5,  1.5),
  ('施罗德亚洲高息股债基金M类别(人民币派息)',    'Schroders',    64, 23, 13,  2.0)
ON CONFLICT (fund_name) DO UPDATE SET
  brand            = EXCLUDED.brand,
  equity_pct       = EXCLUDED.equity_pct,
  fixed_income_pct = EXCLUDED.fixed_income_pct,
  cash_pct         = EXCLUDED.cash_pct,
  fee_rate         = EXCLUDED.fee_rate,
  updated_at       = NOW();

-- 验证
SELECT fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate
FROM mrf_funds ORDER BY brand, fund_name;
