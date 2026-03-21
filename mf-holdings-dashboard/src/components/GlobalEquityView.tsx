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

  return (
    <div className="space-y-4 px-3 pb-8 md:px-0">
      <div
        className="rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.7)]"
        style={{ fontFamily: "var(--font-sans, Inter, sans-serif)" }}
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
          {ticker} · 公开市场数据（非美股简版）
        </div>
        <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
          <div className="font-mono text-3xl font-semibold text-white md:text-4xl">
            {formatSpotLabel(ticker, quote.price)}
          </div>
          <div className={up ? "text-[#1D9E75]" : "text-[#D85A30]"}>
            {up ? "+" : ""}
            {quote.change.toFixed(2)} ({up ? "+" : ""}
            {pct.toFixed(2)}%)
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          演示环境报价与走势为本地 mock；生产可接 Yahoo/AkShare 等。深度分析中的 PE/PB 已由{" "}
          <code className="rounded bg-black/30 px-1">scripts/fetch_market_data.py</code> 多源补全。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {quote.pe != null && (
            <div>
              <div className="text-[10px] uppercase text-gray-500">P/E（示意）</div>
              <div className="font-mono text-white">{quote.pe.toFixed(1)}</div>
            </div>
          )}
          {quote.beta != null && (
            <div>
              <div className="text-[10px] uppercase text-gray-500">Beta</div>
              <div className="font-mono text-white">{quote.beta.toFixed(2)}</div>
            </div>
          )}
          {quote.marketCap != null && (
            <div>
              <div className="text-[10px] uppercase text-gray-500">市值（示意）</div>
              <div className="font-mono text-xs text-white">{quote.marketCap.toExponential(2)}</div>
            </div>
          )}
        </div>
      </div>

      <StockPriceChart ticker={ticker} currentPrice={quote.price} chartHeight={240} />

      <div className="text-center">
        <Link href="/mrf" className="text-sm text-sky-400 hover:underline">
          ← 返回 MRF 基金池
        </Link>
      </div>
    </div>
  );
}
