/** 与 Supabase `fund_performance` 表字段对齐（百分比数值，如 0.32 表示 +0.32%） */
export interface FundPerformance {
  daily_return: number | null;
  weekly_return: number | null;
  monthly_1: number | null;
  monthly_3: number | null;
  monthly_6: number | null;
  yearly_1: number | null;
  updated_at: string | null;
}
