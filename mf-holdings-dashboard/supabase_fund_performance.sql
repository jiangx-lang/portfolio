-- 在 Supabase SQL Editor 执行：QD / MRF 共用，fund_code 与 fund_list.code / 产品代码一致
-- nav_history 使用 (isin, ccy, nav_date)；绩效由 scripts/calc_performance.py 从 nav 计算后写入

CREATE TABLE IF NOT EXISTS fund_performance (
  fund_code     TEXT PRIMARY KEY,
  daily_return  NUMERIC(8,4),
  weekly_return NUMERIC(8,4),
  monthly_1     NUMERIC(8,4),
  monthly_3     NUMERIC(8,4),
  monthly_6     NUMERIC(8,4),
  yearly_1      NUMERIC(8,4),
  nav_date      DATE,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 若表已存在但缺少 nav_date（旧版脚本），执行：
-- ALTER TABLE fund_performance ADD COLUMN IF NOT EXISTS nav_date DATE;

CREATE INDEX IF NOT EXISTS idx_fund_performance_updated_at ON fund_performance (updated_at DESC);
