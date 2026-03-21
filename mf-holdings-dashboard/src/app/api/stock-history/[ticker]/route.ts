import { NextResponse } from "next/server";

function generateMockHistory(
  _ticker: string,
  currentPrice: number,
  days: number
): { date: string; price: number }[] {
  const prices: { date: string; price: number }[] = [];
  const volatility = 0.02;
  let price = currentPrice * (1 - Math.random() * 0.2);

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const change = (Math.random() - 0.48) * volatility;
    price = price * (1 + change);
    prices.push({ date: dateStr, price: Number(price.toFixed(2)) });
  }

  if (prices.length > 0) prices[prices.length - 1].price = currentPrice;
  return prices;
}

const MOCK_PRICES: Record<string, number> = {
  NVDA: 183.67,
  MSFT: 415.5,
  AAPL: 220.0,
  GOOGL: 175.8,
  GOOG: 176.1,
  META: 570.0,
  AVGO: 175.0,
  AMZN: 198.2,
  TSLA: 248.5,
  AMAT: 190.0,
  CRM: 300.0,
  TSM: 180.0,
  JPM: 245.0,
  V: 340.0,
  MA: 530.0,
  AMD: 110.0,
  WFC: 75.0,
  // 常见美股补充（用于 /stock/* 和走势图）
  WM: 225.0,
  MCD: 290.0,
  CTVA: 58.0,
  NTR: 48.0,
  CF: 85.0,
  ADRNY: 32.0,
  DE: 420.0,
  TSN: 55.0,
  BG: 95.0,
  AGCO: 85.0,
  MHGVY: 12.0,
  LLY: 820.0,
  JNJ: 160.0,
  UNH: 520.0,
  PFE: 27.0,
  ABBV: 175.0,
  BMY: 58.0,
  ISRG: 480.0,
  SYK: 390.0,
  ORCL: 165.0,
  ACN: 380.0,
  CRWD: 370.0,
  SNOW: 155.0,
  APP: 380.0,
  SHOP: 110.0,
  NFLX: 950.0,
  TTWO: 165.0,
  MELI: 2100.0,
  SE: 90.0,
  BIDU: 90.0,
  NTES: 92.0,
  PDD: 135.0,
  TCOM: 72.0,
  HOOD: 52.0,
  NU: 14.0,
  SQ: 80.0,
  BABA: 118.0,
  XOM: 108.0,
  CVX: 155.0,
  BP: 35.0,
  TTE: 65.0,
  ROK: 265.0,
  L: 78.0,
  ETN: 340.0,
  EQIX: 850.0,
  IRM: 115.0,
  PSA: 320.0,
  DLR: 160.0,
  EQR: 68.0,
  WMT: 95.0,
  COST: 960.0,
  NVO: 75.0,
  AZN: 72.0,
  RHHBY: 36.0,
  NVS: 98.0,
  GSK: 38.0,
  GILD: 97.0,
  WMB: 54.0,
  COP: 110.0,
  KO: 68.0,
  ICE: 165.0,
  CME: 240.0,
  TXN: 185.0,
  ADI: 195.0,
  APH: 75.0,
  LRCX: 680.0,
  MU: 98.0,
  ASML: 680.0,
  MRVL: 87.0,
  CIEN: 65.0,
  FLEX: 32.0,
  WEX: 195.0,
  TJX: 125.0,
  ADSK: 285.0,
  VRT: 110.0,
  HCA: 360.0,
  ELV: 440.0,
  MDT: 87.0,
  BSX: 90.0,
  MCK: 680.0,
  TMO: 490.0,
  VRTX: 465.0,
  SAP: 240.0,
  ABB: 55.0,
  ING: 18.0,
  VALE: 11.0,
  GOLD: 19.0,
  NEM: 51.0,
  WPM: 57.0,
  PAAS: 22.0,
  KGC: 10.0,
  AEM: 85.0,
  UBS: 28.0,
  DB: 19.0,
  BCS: 11.0,
  MS: 125.0,
  BAC: 44.0,
  C: 73.0,
  AXP: 290.0,
  SCHW: 77.0,
  "0700.HK": 508.0,
  "000660.KS": 1007000.0,
  "300308.SZ": 420.0,
};

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const ticker = (params.ticker || "").toUpperCase();
  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "3M";

  const days = range === "1M" ? 30 : range === "1Y" ? 365 : 90;
  const currentPrice = MOCK_PRICES[ticker] ?? Math.round(50 + Math.random() * 200);

  // TODO: 后续替换为 Yahoo Finance 真实数据
  const data = generateMockHistory(ticker, currentPrice, days);

  return NextResponse.json({ history: data }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

