import { NextResponse } from "next/server";
import { fetchMarketDataViaPython } from "@/lib/marketDataPython";
import { runFundDeepAnalysisGroq } from "@/lib/fundDeepAnalysisGroq";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Single POST: yfinance (Python) + Qwen 分析。
 * Body: { fundName: string, holdings: { ticker, weight }[] }
 */
export async function POST(req: Request) {
  const key = process.env.QWEN_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "missing_QWEN_API_KEY" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const fundName = String(body?.fundName ?? "");
    const holdings = Array.isArray(body?.holdings) ? body.holdings : [];

    const normalized = holdings
      .map((h: { ticker?: string; weight?: number }) => ({
        ticker: String(h.ticker || "").trim(),
        weight: typeof h.weight === "number" ? h.weight : parseFloat(String(h.weight)) || 0,
      }))
      .filter((h: { ticker: string; weight: number }) => h.ticker.length > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "no_equity_holdings" }, { status: 400 });
    }

    const marketData = await fetchMarketDataViaPython(normalized);
    const analysis = await runFundDeepAnalysisGroq(fundName, marketData as any[], key);

    return NextResponse.json({ marketData, analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
