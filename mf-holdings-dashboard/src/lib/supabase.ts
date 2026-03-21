/**
 * Supabase client for server-side only (API routes).
 * Do not import in client components — keys must stay server-side.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key);
  }
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

/** 根据基金 code 查 fund_list 返回 isin, ccy */
export async function getFundByCode(code: string): Promise<{ isin: string; ccy: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("fund_list")
    .select("isin, ccy")
    .eq("code", code.trim())
    .limit(1)
    .maybeSingle();
  if (error || !data?.isin) return null;
  return { isin: data.isin, ccy: (data.ccy as string) || "USD" };
}

const NAV_LIMIT = 252;

/** 获取单只基金最近 NAV 曲线及最新净值、YTD */
export async function getNavHistory(isin: string, ccy: string): Promise<{
  dates: string[];
  navs: number[];
  latestNav: number;
  ytd: number;
}> {
  const supabase = getSupabase();
  const empty = { dates: [], navs: [], latestNav: 0, ytd: 0 };
  if (!supabase) return empty;

  const thisYear = new Date().getFullYear();
  const startDate = `${thisYear - 1}-01-01`;

  const { data, error } = await supabase
    .from("nav_history")
    .select("nav_date, nav")
    .eq("isin", isin)
    .eq("ccy", ccy)
    .gte("nav_date", startDate)
    .order("nav_date", { ascending: false })
    .limit(NAV_LIMIT);

  if (error || !data?.length) return empty;

  const sorted = [...data].reverse();
  const dates = sorted.map((r) => String(r.nav_date).slice(0, 10));
  const navs = sorted.map((r) => Number(r.nav));
  const latestNav = navs[navs.length - 1] ?? 0;
  const firstOfYear = sorted.find((r) => String(r.nav_date).startsWith(`${thisYear}-`));
  const ytdNav = firstOfYear ? Number(firstOfYear.nav) : navs[0] ?? latestNav;
  const ytd = ytdNav && latestNav ? ((latestNav - ytdNav) / ytdNav) * 100 : 0;

  return { dates, navs, latestNav, ytd };
}

/** MRF 基金池单行 */
export interface MrfFundRow {
  fund_name: string;
  brand: string;
  equity_pct: number;
  fixed_income_pct: number;
  cash_pct: number;
  fee_rate: number;
  sc_product_code?: string | null;
}

/** 从 Supabase mrf_funds 表读取 MRF 基金池 */
export async function getMrfFunds(): Promise<MrfFundRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mrf_funds")
    .select("fund_name, brand, equity_pct, fixed_income_pct, cash_pct, fee_rate, sc_product_code")
    .order("fund_name");
  if (error) return [];
  return (data ?? []).map((r) => ({
    fund_name: String(r.fund_name),
    brand: String(r.brand ?? ""),
    equity_pct: Number(r.equity_pct ?? 0),
    fixed_income_pct: Number(r.fixed_income_pct ?? 0),
    cash_pct: Number(r.cash_pct ?? 0),
    fee_rate: Number(r.fee_rate ?? 0),
    sc_product_code: r.sc_product_code != null ? String(r.sc_product_code) : undefined,
  }));
}
