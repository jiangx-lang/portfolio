import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MRF_FUNDS = [
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
  { fund_name: "惠理高息股票基金", brand: "ValuePartners", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: "968007" }
];

export async function GET() {
  try {
    const supabase = getSupabaseServiceRole();
    if (!supabase) {
      throw new Error("Supabase Service Role Key is missing");
    }

    const { data: perfData, error } = await supabase
      .from("fund_performance")
      .select("*");

    if (error) throw error;

    const perfMap = new Map((perfData ?? []).map((p: { fund_code: string }) => [String(p.fund_code), p]));

    const funds = MRF_FUNDS.map((fund) => {
      const code = fund.sc_product_code;
      return {
        ...fund,
        performance: code ? (perfMap.get(code) || null) : null
      };
    });

    return NextResponse.json({
      funds,
      performanceLastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[MRF API Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
