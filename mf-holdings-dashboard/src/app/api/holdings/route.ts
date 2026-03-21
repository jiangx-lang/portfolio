import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { MOCK_HOLDINGS } from "@/lib/mockData";
import type { Holding } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchHoldingsFromSupabase(): Promise<Holding[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // 1. 基金列表（Supabase fund_list: code, isin, ccy）
  const { data: funds, error: fundsError } = await supabase
    .from("fund_list")
    .select("code, isin, ccy")
    .order("code");

  if (fundsError || !funds?.length) {
    return [];
  }

  const holdings: Holding[] = [];
  const n = funds.length;
  const weight = n > 0 ? 100 / n : 0;

  const thisYear = new Date().getFullYear();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().slice(0, 10);

  for (const f of funds) {
    const code = String(f.code ?? "").trim();
    const isin = String(f.isin ?? "").trim();
    const ccy = String(f.ccy ?? "USD").trim();
    if (!isin) continue;

    // 2. 过去约 1 年净值（limit 252 个交易日）
    const { data: navRows, error: navError } = await supabase
      .from("nav_history")
      .select("nav_date, nav")
      .eq("isin", isin)
      .eq("ccy", ccy)
      .gte("nav_date", startDate)
      .order("nav_date", { ascending: false })
      .limit(260);

    if (navError || !navRows?.length) {
      holdings.push({
        ticker: code || isin,
        name: code || isin,
        sector: "QDII",
        weight,
        price: 0,
        change: 0,
        changePercent: 0,
        pe: null,
        ytd: 0,
        beta: 1,
        high52: 0,
        low52: 0,
        sharpe: 0,
        marketCap: 0,
        signal: "hold",
        thesis: `${code || isin} QDII Fund`,
      });
      continue;
    }

    const sorted = [...navRows].sort(
      (a, b) => (a.nav_date as string).localeCompare(b.nav_date as string)
    );
    const latest = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : latest;
    const navs = sorted.map((r) => Number(r.nav));
    const latestNav = Number(latest?.nav ?? 0);
    const prevNav = Number(prev?.nav ?? latestNav);
    const high52 = navs.length ? Math.max(...navs) : latestNav;
    const low52 = navs.length ? Math.min(...navs) : latestNav;

    const change = latestNav - prevNav;
    const changePercent = prevNav ? (change / prevNav) * 100 : 0;

    const firstOfYear = sorted.find(
      (r) => (r.nav_date as string) >= `${thisYear}-01-01`
    );
    const ytdNav = firstOfYear ? Number(firstOfYear.nav) : (sorted[0] ? Number(sorted[0].nav) : latestNav);
    const ytd = ytdNav && latestNav ? ((latestNav - ytdNav) / ytdNav) * 100 : 0;

    holdings.push({
      ticker: code || isin,
      name: code || isin,
      sector: "QDII",
      weight,
      price: latestNav,
      change,
      changePercent,
      pe: null,
      ytd,
      beta: 1,
      high52,
      low52,
      sharpe: 0,
      marketCap: 0,
      signal: "hold",
      thesis: `${code || isin} QDII Fund`,
    });
  }

  return holdings.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
}

export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      const holdings = await fetchHoldingsFromSupabase();
      if (holdings.length > 0) {
        return NextResponse.json(holdings);
      }
    }
    return NextResponse.json(MOCK_HOLDINGS);
  } catch (e) {
    console.error(e);
    return NextResponse.json(MOCK_HOLDINGS);
  }
}
