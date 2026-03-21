import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Fallback: mirrors app.py MRF_POOL exactly
const MRF_MOCK = [
  { fund_name: "东方汇理香港组合-灵活配置增长", brand: "Amundi", equity_pct: 70, fixed_income_pct: 25, cash_pct: 5, fee_rate: 3.0, sc_product_code: null },
  { fund_name: "东方汇理香港组合-灵活配置均衡", brand: "Amundi", equity_pct: 50, fixed_income_pct: 45, cash_pct: 5, fee_rate: 3.0, sc_product_code: null },
  { fund_name: "东方汇理香港组合-灵活配置平稳", brand: "Amundi", equity_pct: 30, fixed_income_pct: 60, cash_pct: 10, fee_rate: 3.0, sc_product_code: null },
  { fund_name: "东亚联丰环球股票基金", brand: "BEA", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: null },
  { fund_name: "东亚联丰亚洲债券及货币基金", brand: "BEA", equity_pct: 0, fixed_income_pct: 95, cash_pct: 5, fee_rate: 2.0, sc_product_code: null },
  { fund_name: "惠理高息股票基金", brand: "ValuePartners", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: null },
  { fund_name: "惠理价值基金", brand: "ValuePartners", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: null },
  { fund_name: "摩根国际债", brand: "JPM", equity_pct: 0, fixed_income_pct: 95, cash_pct: 5, fee_rate: 2.0, sc_product_code: null },
  { fund_name: "摩根太平洋科技", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: null },
  { fund_name: "摩根太平洋证券", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: null },
  { fund_name: "摩根亚洲股息", brand: "JPM", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 2.5, sc_product_code: null },
  { fund_name: "摩根亚洲总收益", brand: "JPM", equity_pct: 50, fixed_income_pct: 45, cash_pct: 5, fee_rate: 1.0, sc_product_code: null },
  { fund_name: "瑞士百达策略收益基金", brand: "Pictet", equity_pct: 40, fixed_income_pct: 50, cash_pct: 10, fee_rate: 3.0, sc_product_code: null },
  { fund_name: "中银香港环球股票基金", brand: "BOC", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: "968031" },
  { fund_name: "中银香港香港股票基金", brand: "BOC", equity_pct: 95, fixed_income_pct: 0, cash_pct: 5, fee_rate: 1.5, sc_product_code: "968030" },
  { fund_name: "施罗德亚洲高息股债基金M类别(人民币派息)", brand: "Schroders", equity_pct: 64, fixed_income_pct: 23, cash_pct: 13, fee_rate: 2.0, sc_product_code: null },
];

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(MRF_MOCK);
    }
    const { data, error } = await supabase
      .from("mrf_funds")
      .select("fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate, sc_product_code")
      .order("fund_name");

    if (error || !data || data.length === 0) {
      return NextResponse.json(MRF_MOCK);
    }
    // 与 getMrfFunds 一致：避免 PostgREST 把代码序列化成 number 导致前端 .trim() 抛错
    const normalized = (data ?? []).map((r) => ({
      fund_name: String((r as { fund_name?: string }).fund_name ?? ""),
      brand: String((r as { brand?: string }).brand ?? ""),
      equity_pct: Number((r as { equity_pct?: number }).equity_pct ?? 0),
      fixed_income_pct: Number((r as { fixed_income_pct?: number }).fixed_income_pct ?? 0),
      cash_pct: Number((r as { cash_pct?: number }).cash_pct ?? 0),
      fee_rate: Number((r as { fee_rate?: number }).fee_rate ?? 0),
      sc_product_code: (() => {
        const c = (r as { sc_product_code?: string | number | null }).sc_product_code;
        if (c == null) return null;
        const s = String(c).trim();
        return s.length ? s : null;
      })(),
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    console.error("[MRF] API error:", err);
    return NextResponse.json(MRF_MOCK);
  }
}
