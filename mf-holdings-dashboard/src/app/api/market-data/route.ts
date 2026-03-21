import { NextResponse } from "next/server";
import { fetchMarketDataViaPython } from "@/lib/marketDataPython";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const holdings = Array.isArray(body?.holdings) ? body.holdings : [];
    const normalized = holdings
      .map((h: { ticker?: string; weight?: number }) => ({
        ticker: String(h.ticker || "").trim(),
        weight: typeof h.weight === "number" ? h.weight : parseFloat(String(h.weight)) || 0,
      }))
      .filter((h: { ticker: string; weight: number }) => h.ticker.length > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ error: "no_holdings" }, { status: 400 });
    }

    const data = await fetchMarketDataViaPython(normalized);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
