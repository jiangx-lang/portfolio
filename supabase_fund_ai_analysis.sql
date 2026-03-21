-- ============================================================
-- fund_ai_analysis：基金 AI 分析缓存（MRF + QD）
-- 在 Supabase SQL Editor 执行
-- ============================================================

CREATE TABLE IF NOT EXISTS fund_ai_analysis (
  id SERIAL PRIMARY KEY,
  fund_code TEXT NOT NULL,        -- MRF 用 fund_name，QD 用 primary_code
  fund_type TEXT NOT NULL,        -- 'MRF' 或 'QD'
  fund_name TEXT NOT NULL,
  signal TEXT,                    -- strong_buy/buy/hold/trim/sell
  confidence INTEGER,
  summary TEXT,
  thesis TEXT,
  strengths JSONB,
  risks JSONB,
  fee_assessment TEXT,
  suitable_investor TEXT,
  allocation_comment TEXT,
  recommendation TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fund_code, fund_type)    -- 每只基金只存一条，重跑时更新
);

ALTER TABLE fund_ai_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read" ON fund_ai_analysis;
DROP POLICY IF EXISTS "allow_all" ON fund_ai_analysis;
CREATE POLICY "allow_read" ON fund_ai_analysis FOR SELECT USING (true);
CREATE POLICY "allow_all" ON fund_ai_analysis FOR ALL USING (true);

