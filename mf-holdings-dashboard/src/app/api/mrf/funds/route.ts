import { NextResponse } from "next/server";
import { fetchFundPerformanceBulk, getSupabase, lookupFundPerformance } from "@/lib/supabase";

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

// MRF 统一数字代码映射（用于兜底修正中文/脏 sc_product_code）
const MRF_CODE_BY_NAME: Record<string, string> = {
  东方汇理香港组合-灵活配置增长: "968001",
  东方汇理香港组合-灵活配置均衡: "968002",
  东方汇理香港组合-灵活配置平稳: "968003",
  东亚联丰环球股票基金: "968004",
  东亚联丰亚洲债券及货币基金: "968005",
  惠理高息股票基金: "968006",
  惠理价值基金: "968007",
  摩根国际债: "968050",
  摩根太平洋科技: "968009",
  摩根太平洋证券: "968010",
  摩根亚洲股息: "968011",
  摩根亚洲总收益: "968000",
  瑞士百达策略收益基金: "968013",
  中银香港环球股票基金: "968031",
  中银香港香港股票基金: "968030",
  施罗德亚洲高息股债基金M类别(人民币派息): "968166",
};

function isLikelyChineseText(s: string): boolean {
  return /[\u3400-\u9FFF]/.test(s);
}

function normalizeMrfNumericCode(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^968\d{3,}$/.test(s) ? s : "";
}

function normalizePerfKey(v: unknown): string {
  const s = String(v ?? "").trim();
  return s ? s.toUpperCase() : "";
}

export async function GET() {
  try {
    const { byCode: perfByCode, lastUpdated: performanceLastUpdated } = await fetchFundPerformanceBulk();
    console.log("MRF Perf Map Size:", perfByCode.size);
    console.log("Sample Keys in Map:", Array.from(perfByCode.keys()).slice(0, 5));

    const mergePerf = <T extends { sc_product_code?: string | null; fund_name?: string; code?: string | null; isin?: string | null }>(rows: T[]) =>
      rows.map((r) => {
        const rawSc = String(r.sc_product_code ?? "").trim();
        const bySc = normalizeMrfNumericCode(rawSc);
        const byCode = normalizeMrfNumericCode(r.code);
        const byIsin = normalizeMrfNumericCode(r.isin);
        const byName = normalizeMrfNumericCode(MRF_CODE_BY_NAME[String(r.fund_name ?? "").trim()]);
        const primary = bySc || byCode || byIsin || byName;

        // 若 sc_product_code 是中文，优先回退到 code/isin/名称映射
        const candidateKeys = isLikelyChineseText(rawSc)
          ? [byCode, byIsin, byName, bySc]
          : [bySc, byCode, byIsin, byName];
        const resolved = candidateKeys.find((k) => k.length > 0) ?? "";
        const c = normalizePerfKey(resolved || primary);

        const performance = c ? lookupFundPerformance(perfByCode, c) ?? null : null;
        // 临时排查：确认 MRF 取到的匹配键
        console.log("MRF Match Debug:", c || "(empty)");
        if (c && !performance) {
          const sample = Array.from(perfByCode.keys()).slice(0, 8).join(", ");
          console.warn("[MRF] performance miss:", {
            fund_name: r.fund_name ?? "",
            sc_product_code: c,
            perf_map_size: perfByCode.size,
            perf_map_sample_keys: sample,
          });
        }
        return { ...r, performance };
      });

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        funds: mergePerf(MRF_MOCK),
        performanceLastUpdated,
      });
    }
    const { data, error } = await supabase
      .from("mrf_funds")
      .select("fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate, sc_product_code")
      .order("fund_name");

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        funds: mergePerf(MRF_MOCK),
        performanceLastUpdated,
      });
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
      // 兼容 fallback 逻辑：若 sc_product_code 非数字，尝试用映射生成数字 code
      code: (() => {
        const name = String((r as { fund_name?: string }).fund_name ?? "").trim();
        const sc = String((r as { sc_product_code?: string | number | null }).sc_product_code ?? "").trim();
        return normalizeMrfNumericCode(sc) || MRF_CODE_BY_NAME[name] || null;
      })(),
      isin: (() => {
        const name = String((r as { fund_name?: string }).fund_name ?? "").trim();
        const sc = String((r as { sc_product_code?: string | number | null }).sc_product_code ?? "").trim();
        return normalizeMrfNumericCode(sc) || MRF_CODE_BY_NAME[name] || null;
      })(),
    }));
    return NextResponse.json({
      funds: mergePerf(normalized),
      performanceLastUpdated,
    });
  } catch (err) {
    console.error("[MRF] API error:", err);
    const { byCode, lastUpdated } = await fetchFundPerformanceBulk();
    const mergePerf = (rows: typeof MRF_MOCK) =>
      rows.map((r) => {
        const c = normalizePerfKey(r.sc_product_code);
        const performance = c ? lookupFundPerformance(byCode, c) ?? null : null;
        console.log("MRF Match Debug:", c || "(empty)");
        return { ...r, performance };
      });
    return NextResponse.json({ funds: mergePerf(MRF_MOCK), performanceLastUpdated: lastUpdated });
  }
}
