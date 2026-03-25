/**
 * Supabase client for server-side only (API routes).
 * Do not import in client components — keys must stay server-side.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FundPerformance } from "@/types/fund";

let _client: SupabaseClient | null = null;
let _serviceClient: SupabaseClient | null = null;

/**
 * 仅服务端 API / Server Components 使用；勿在客户端 import。
 * 密钥名必须为 SUPABASE_SERVICE_ROLE_KEY（勿加 NEXT_PUBLIC_）。
 */
export function getSupabaseServiceRole(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  if (!_serviceClient) {
    _serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return _serviceClient;
}

/**
 * 服务端 API 用 Publishable（或旧 anon JWT）。
 * Vercel 上若只配了 NEXT_PUBLIC_SUPABASE_* 而未单独设 SUPABASE_URL / SUPABASE_KEY，此处会回退读取，避免埋点/净值等报「未配置」。
 */
export function getSupabase(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim();
  const key = (
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key);
  }
  return _client;
}

export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim();
  const key = (
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return !!(url && key);
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

function navDateFromRow(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

function performanceFromRow(row: Record<string, unknown>): FundPerformance {
  const num = (v: unknown): number | null =>
    v == null || v === "" ? null : Number(v);
  const nNav = num(row.nav);
  return {
    daily_return: num(row.daily_return),
    weekly_return: num(row.weekly_return),
    monthly_1: num(row.monthly_1),
    monthly_3: num(row.monthly_3),
    monthly_6: num(row.monthly_6),
    yearly_1: num(row.yearly_1),
    nav: nNav != null && !Number.isNaN(nNav) ? nNav : null,
    nav_date: navDateFromRow(row.nav_date),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

/** 按产品代码匹配绩效（trim + 大小写不敏感） */
export function lookupFundPerformance(
  byCode: Map<string, FundPerformance>,
  code: string | null | undefined
): FundPerformance | undefined {
  const c = String(code ?? "").trim();
  if (!c) return undefined;
  return byCode.get(c) ?? byCode.get(c.toUpperCase());
}

/**
 * 分页拉取 `fund_performance` 全表，供 QD/MRF 列表合并。
 * 优先使用 Service Role（绕过 RLS）；否则回退 anon —— 若表开了 RLS 且未给 anon SELECT，必须用 SUPABASE_SERVICE_ROLE_KEY。
 * 表不存在或无权访问时返回空 Map（不抛错）。
 */
export async function fetchFundPerformanceBulk(): Promise<{
  byCode: Map<string, FundPerformance>;
  lastUpdated: string | null;
}> {
  const supabase = getSupabaseServiceRole() ?? getSupabase();
  const empty: { byCode: Map<string, FundPerformance>; lastUpdated: string | null } = {
    byCode: new Map(),
    lastUpdated: null,
  };
  if (!supabase) return empty;

  const byCode = new Map<string, FundPerformance>();
  let lastUpdated: string | null = null;
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("fund_performance")
      .select(
        "fund_code, daily_return, weekly_return, monthly_1, monthly_3, monthly_6, yearly_1, nav, nav_date, updated_at"
      )
      .order("fund_code", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("[fetchFundPerformanceBulk]", error.message);
      return empty;
    }
    if (!data?.length) break;

    for (const raw of data) {
      const row = raw as Record<string, unknown>;
      const code = String(row.fund_code ?? "").trim();
      if (!code) continue;
      const perf = performanceFromRow(row);
      byCode.set(code, perf);
      const up = code.toUpperCase();
      if (up !== code) byCode.set(up, perf);
      const ua = perf.updated_at;
      if (ua && (!lastUpdated || ua > lastUpdated)) lastUpdated = ua;
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return { byCode, lastUpdated };
}
