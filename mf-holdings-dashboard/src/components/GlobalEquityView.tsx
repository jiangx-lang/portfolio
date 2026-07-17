"use client";

import Link from "next/link";
import StockPriceChart from "@/components/StockPriceChart";
import type { QuoteResult } from "@/lib/yahoo";

function formatSpotLabel(ticker: string, price: number): string {
  const t = ticker.toUpperCase();
  if (t.endsWith(".KS") || t.endsWith(".KQ")) {
    return `${Math.round(price).toLocaleString("en-US")} KRW`;
  }
  if (t.endsWith(".HK")) {
    return `HK$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (t.endsWith(".SS") || t.endsWith(".SZ") || t.endsWith(".SH")) {
    return `¥${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (t.endsWith(".TW")) {
    return `NT$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (t.endsWith(".T") && !t.includes(".TW")) {
    return `¥${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} JPY`;
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  ticker: string;
  quote: QuoteResult;
}

/** 非美股：来自 MRF/QDII 映射的港韩 A 日欧等代码，展示报价示意 + 走势（mock），无期权链 */
export function GlobalEquityView({ ticker, quote }: Props) {
  const pct = quote.changePercent;
  const up = pct >= 0;
  // 中国市场惯例：红涨绿跌，零值持平色
  const tone = pct > 0 ? "text-rise" : pct < 0 ? "text-fall" : "text-flat";

  return (
    <div className="space-y-4 px-3 pb-8 md:px-0">
      <div className="glass-panel glow-border animate-in p-5 md:p-8">
        <span className="eyebrow">GLOBAL EQUITY · 非美股简版</span>
        <h2 className="font-display mt-2 text-2xl font-bold text-slate-100 md:text-3xl">
          {ticker}
        </h2>
        <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
          <div className="font-mono text-3xl font-semibold tabular-nums text-slate-50 md:text-4xl">
            {formatSpotLabel(ticker, quote.price)}
          </div>
          <div className={`font-mono text-sm md:text-base ${tone}`}>
            {up ? "+" : ""}
            {quote.change.toFixed(2)} ({up ? "+" : ""}
            {pct.toFixed(2)}%)
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          演示环境报价与走势为本地 mock；生产可接 Yahoo/AkShare 等。深度分析中的 PE/PB 已由{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-slate-400">
            scripts/fetch_market_data.py
          </code>{" "}
          多源补全。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {quote.pe != null && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-slate-500">
                P/E（示意）
              </div>
              <div className="font-mono text-slate-100">{quote.pe.toFixed(1)}</div>
            </div>
          )}
          {quote.beta != null && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-slate-500">
                Beta
              </div>
              <div className="font-mono text-slate-100">{quote.beta.toFixed(2)}</div>
            </div>
          )}
          {quote.marketCap != null && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-slate-500">
                市值（示意）
              </div>
              <div className="font-mono text-xs text-slate-100">
                {quote.marketCap.toExponential(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <StockPriceChart ticker={ticker} currentPrice={quote.price} chartHeight={240} />

      <div className="text-center">
        <Link href="/mrf" className="text-sm text-info hover:underline">
          ← 返回 MRF 基金池
        </Link>
      </div>
    </div>
  );
}
