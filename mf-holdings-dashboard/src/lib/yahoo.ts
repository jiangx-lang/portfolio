/**
 * Quote and IV data: mock with 60s cache and 500ms delay.
 * To wire real data: use yahoo-finance2 in a server-only path (e.g. API route inline
 * or a separate service) and call it from GET /api/quote and /api/iv; avoid importing
 * yahoo-finance2 in shared lib so Next.js doesn't bundle its test deps.
 */

import { MOCK_HOLDINGS } from "./mockData";
import { mockIVStats } from "./mockData";
import type { IVStats } from "@/types";

const CACHE_MS = 60_000;
const DELAY_MS = 500;

const cache = new Map<string, { data: unknown; ts: number }>();

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getCached<T>(key: string): T | null {
  const ent = cache.get(key);
  if (!ent || Date.now() - ent.ts > CACHE_MS) return null;
  return ent.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

export interface QuoteResult {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52?: number;
  low52?: number;
  beta?: number;
  pe?: number;
  eps?: number;
}

export async function fetchQuote(ticker: string): Promise<QuoteResult> {
  const cacheKey = `quote:${ticker.toUpperCase()}`;
  const cached = getCached<QuoteResult>(cacheKey);
  if (cached) return cached;

  await delay(DELAY_MS);
  const mock = MOCK_HOLDINGS.find((h) => h.ticker === ticker.toUpperCase());
  if (mock) {
    const result: QuoteResult = {
      price: mock.price,
      change: mock.change,
      changePercent: mock.changePercent,
      volume: 1_000_000,
      marketCap: mock.marketCap,
      high52: mock.high52,
      low52: mock.low52,
      beta: mock.beta,
      pe: mock.pe ?? undefined,
    };
    setCache(cacheKey, result);
    return result;
  }
  // 没在 Top10 mock 里：用更完整的 mock price 表；仍未命中则生成一个“合理”价格，避免 /stock/WM 之类 404/空数据体验
  const MOCK_PRICES: Record<string, number> = {
    NVDA: 183.67, MSFT: 415.5, AAPL: 220.0, GOOGL: 175.8, META: 570.0, AVGO: 175.0, AMZN: 198.2, TSLA: 248.5,
    AMAT: 190.0, CRM: 300.0, TSM: 180.0, JPM: 245.0, V: 340.0, MA: 530.0, AMD: 110.0, WFC: 75.0,
    WM: 225.0, MCD: 290.0, CTVA: 58.0, NTR: 48.0, CF: 85.0, ADRNY: 32.0, DE: 420.0, TSN: 55.0, BG: 95.0,
    AGCO: 85.0, MHGVY: 12.0, LLY: 820.0, JNJ: 160.0, UNH: 520.0, PFE: 27.0, ABBV: 175.0, BMY: 58.0,
    ISRG: 480.0, SYK: 390.0, ORCL: 165.0, ACN: 380.0, CRWD: 370.0, SNOW: 155.0, APP: 380.0, SHOP: 110.0,
    NFLX: 950.0, TTWO: 165.0, MELI: 2100.0, SE: 90.0, BIDU: 90.0, NTES: 92.0, PDD: 135.0, TCOM: 72.0,
    HOOD: 52.0, NU: 14.0, SQ: 80.0, BABA: 118.0, XOM: 108.0, CVX: 155.0, BP: 35.0, TTE: 65.0, ROK: 265.0,
    L: 78.0, ETN: 340.0, EQIX: 850.0, IRM: 115.0, PSA: 320.0, DLR: 160.0, EQR: 68.0, WMT: 95.0, COST: 960.0,
    NVO: 75.0, AZN: 72.0, RHHBY: 36.0, NVS: 98.0, GSK: 38.0, GILD: 97.0, WMB: 54.0, COP: 110.0, KO: 68.0,
    ICE: 165.0, CME: 240.0, TXN: 185.0, ADI: 195.0, APH: 75.0, LRCX: 680.0, MU: 98.0, ASML: 680.0,
    MRVL: 87.0, CIEN: 65.0, FLEX: 32.0, WEX: 195.0, TJX: 125.0, ADSK: 285.0, VRT: 110.0, HCA: 360.0,
    ELV: 440.0, MDT: 87.0, BSX: 90.0, MCK: 680.0, TMO: 490.0, VRTX: 465.0, SAP: 240.0, ABB: 55.0, ING: 18.0,
    VALE: 11.0, GOLD: 19.0, NEM: 51.0, WPM: 57.0, PAAS: 22.0, KGC: 10.0, AEM: 85.0, UBS: 28.0, DB: 19.0,
    BCS: 11.0, MS: 125.0, BAC: 44.0, C: 73.0, AXP: 290.0, SCHW: 77.0,
  };

  const t = ticker.toUpperCase();
  const price = MOCK_PRICES[t] ?? Math.round(50 + Math.random() * 200);
  const change = Number(((Math.random() - 0.5) * (price * 0.02)).toFixed(2));
  const result: QuoteResult = {
    price,
    change,
    changePercent: price ? (change / price) * 100 : 0,
    volume: 1_000_000,
  };
  setCache(cacheKey, result);
  return result;
}

export async function fetchIVStats(ticker: string): Promise<IVStats> {
  const cacheKey = `iv:${ticker.toUpperCase()}`;
  const cached = getCached<IVStats>(cacheKey);
  if (cached) return cached;

  await delay(DELAY_MS);
  const result = mockIVStats(ticker);
  setCache(cacheKey, result);
  return result;
}
