/** 与 Supabase `fund_performance` 表字段对齐（百分比数值，如 0.32 表示 +0.32%） */
export interface FundPerformance {
  daily_return: number | null;
  weekly_return: number | null;
  monthly_1: number | null;
  monthly_3: number | null;
  monthly_6: number | null;
  yearly_1: number | null;
  /** 与 nav_date 对应的最新单位净值（来自 calc_performance / nav_history） */
  nav: number | null;
  /** 最新净值日期 YYYY-MM-DD */
  nav_date: string | null;
  updated_at: string | null;
}
