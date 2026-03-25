import { NextResponse } from "next/server";
import { getSupabase, getSupabaseServiceRole } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Supabase 不可用时回退；sc_product_code 需与 fund_performance.fund_code 一致（968xxx） */
const MRF_MOCK = [
  { fund_name: "东亚联丰亚洲债券及货币基金", brand: "BEA", equity_pct: 0, fixed_income_pct: 95, cash_pct: 5, fee_rate: 2.0, sc_product_code: "968005" },
  { fund_name: "东亚联丰环球股票基金", brand: "BEA", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968004" },
  { fund_name: "东方汇理香港组合-灵活配置均衡", brand: "Amundi", equity_pct: 50, fixed_income_pct: 45, cash_pct: 5, fee_rate: 3.0, sc_product_code: "968002" },
  { fund_name: "东方汇理香港组合-灵活配置增长", brand: "Amundi", equity_pct: 70, fixed_income_pct: 25, cash_pct: 5, fee_rate: 3.0, sc_product_code: "968001" },
  { fund_name: "东方汇理香港组合-灵活配置平稳", brand: "Amundi", equity_pct: 30, fixed_income_pct: 60, cash_pct: 10, fee_rate: 3.0, sc_product_code: "968003" },
  { fund_name: "摩根亚洲股息", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968009" },
  { fund_name: "摩根亚洲总收益", brand: "JPM", equity_pct: 50, fixed_income_pct: 45, cash_pct: 5, fee_rate: 1.0, sc_product_code: "968010" },
  { fund_name: "摩根国际债", brand: "JPM", equity_pct: 0, fixed_income_pct: 95, cash_pct: 5, fee_rate: 2.0, sc_product_code: "968011" },
  { fund_name: "摩根太平洋科技", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968012" },
  { fund_name: "摩根太平洋证券", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: "968014" },
  { fund_name: "瑞士百达策略收益基金", brand: "Pictet", equity_pct: 40, fixed_income_pct: 50, cash_pct: 10, fee_rate: 3.0, sc_product_code: "968013" },
  { fund_name: "中银香港环球股票基金", brand: "BOC", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: "968031" },
  { fund_name: "中银香港香港股票基金", brand: "BOC", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: "968030" },
  { fund_name: "施罗德亚洲高息股债基金M类别(人民币派息)", brand: "Schroders", equity_pct: 64, fixed_income_pct: 23, cash_pct: 13, fee_rate: 2.0, sc_product_code: "968166" },
  { fund_name: "惠理价值基金", brand: "ValuePartners", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968006" },
  { fund_name: "惠理高息股票基金", brand: "ValuePartners", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968007" },
];

type MrfFund = {
  fund_name: string;
  brand: string;
  equity_pct: number;
  fixed_income_pct: number;
  cash_pct: number;
  fee_rate: number;
  sc_product_code: string | null;
};

type PerfRow = {
  fund_code: string;
  daily_return: number | null;
  weekly_return: number | null;
  monthly_1: number | null;
  monthly_3: number | null;
  monthly_6: number | null;
  yearly_1: number | null;
  nav: number | null;
  nav_date: string | null;
  updated_at: string | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseServiceRole() ?? getSupabase();

    let funds: MrfFund[] = MRF_MOCK;
    if (supabase) {
      const { data, error } = await supabase
        .from("mrf_funds")
        .select("fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate, sc_product_code")
        .order("fund_name");

      if (!error && data && data.length > 0) {
        funds = data.map((r) => ({
          fund_name: String(r.fund_name ?? ""),
          brand: String(r.brand ?? ""),
          equity_pct: Number(r.equity_pct ?? 0),
          fixed_income_pct: Number(r.fixed_income_pct ?? 0),
          cash_pct: Number(r.cash_pct ?? 0),
          fee_rate: Number(r.fee_rate ?? 0),
          sc_product_code: r.sc_product_code != null && String(r.sc_product_code).trim() !== ""
            ? String(r.sc_product_code).trim()
            : null,
        }));
      }
    }

    const scCodes = funds
      .map((f) => f.sc_product_code)
      .filter((c): c is string => !!c);

    const perfMap = new Map<string, PerfRow>();
    let performanceLastUpdated: string | null = null;

    if (supabase && scCodes.length > 0) {
      const { data: perfRows } = await supabase
        .from("fund_performance")
        .select(
          "fund_code, daily_return, weekly_return, monthly_1, monthly_3, monthly_6, yearly_1, nav, nav_date, updated_at"
        )
        .in("fund_code", scCodes);

      if (perfRows) {
        for (const row of perfRows as PerfRow[]) {
          const key = String(row.fund_code ?? "").trim();
          if (!key) continue;
          perfMap.set(key, row);
          if (row.updated_at && (!performanceLastUpdated || row.updated_at > performanceLastUpdated)) {
            performanceLastUpdated = row.updated_at;
          }
        }
      }
    }

    const fundsWithPerf = funds.map((f) => ({
      ...f,
      performance: f.sc_product_code ? perfMap.get(f.sc_product_code) ?? null : null,
    }));

    return NextResponse.json({
      funds: fundsWithPerf,
      performanceLastUpdated,
    });
  } catch (err) {
    console.error("[MRF] API error:", err);
    return NextResponse.json({ funds: MRF_MOCK, performanceLastUpdated: null });
  }
}
