-- 在 Supabase SQL Editor 执行：QD / MRF 共用，以 fund_code 关联 fund_list.code 或产品代码
CREATE TABLE IF NOT EXISTS fund_performance (
  fund_code     TEXT PRIMARY KEY,
  daily_return  NUMERIC(8,4),
  weekly_return NUMERIC(8,4),
  monthly_1     NUMERIC(8,4),
  monthly_3     NUMERIC(8,4),
  monthly_6     NUMERIC(8,4),
  yearly_1      NUMERIC(8,4),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_performance_updated_at ON fund_performance (updated_at DESC);
