-- Part 2C：若无 MRF PDF，在 Supabase 新建 mrf_holdings 表，用于手动维护 968 基金持仓
-- 在 Supabase SQL Editor 执行

CREATE TABLE IF NOT EXISTS mrf_holdings (
  id SERIAL PRIMARY KEY,
  sc_product_code TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  holding_name TEXT NOT NULL,
  holding_type TEXT DEFAULT 'equity',
  weight_pct NUMERIC(6,2),
  as_of_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrf_holdings_code ON mrf_holdings(sc_product_code);

ALTER TABLE mrf_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read" ON mrf_holdings;
CREATE POLICY "allow_read" ON mrf_holdings FOR SELECT USING (true);
