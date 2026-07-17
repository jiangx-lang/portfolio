import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getQuote, getIVStats, getOptionsChain } from "@/lib/publiccom";
import { buildStrategyCards } from "@/lib/strategies";
import { notFound } from "next/navigation";
import { StockDetailClient } from "@/components/StockDetailClient";
import { GlobalEquityView } from "@/components/GlobalEquityView";
import { QdiiFundView } from "@/components/QdiiFundView";
import { isGlobalEquityTicker, isUsStock } from "@/lib/constants";
import { getFundByCode, getNavHistory, isSupabaseConfigured } from "@/lib/supabase";
import { fetchQuote } from "@/lib/yahoo";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();

  if (isUsStock(tickerUpper)) {
    let quote: { price: number; change: number; volume: number };
    let iv: {
      iv30d: number;
      ivRank: number;
      ivPercentile: number;
      iv52wHigh: number;
      iv52wLow: number;
      nextEarnings?: string;
    };
    let optionsChain: Awaited<ReturnType<typeof getOptionsChain>>;
    try {
      [quote, iv] = await Promise.all([
        getQuote(tickerUpper),
        getIVStats(tickerUpper),
      ]);
      optionsChain = await getOptionsChain(tickerUpper, "2025-06-20", quote.price);
    } catch {
      notFound();
    }
    const strategyCards = buildStrategyCards(quote.price, iv.ivRank, iv.iv30d);

    const changePct = quote.price ? (quote.change / quote.price) * 100 : 0;
    const isPositive = quote.change >= 0;

    return (
      <div className="min-h-screen bg-navy">
        <header className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
            {/* 股票头部信息卡 */}
            <div className="glass-panel glow-border animate-in flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-center md:gap-8 md:p-8">
              <div>
                <span className="eyebrow">US EQUITY · STOCK DETAIL</span>
                <h1 className="font-display mt-2 text-2xl font-bold text-slate-100 md:text-3xl">
                  {tickerUpper}
                </h1>
                <div className="mt-2 font-mono text-4xl font-semibold tabular-nums text-slate-50 md:text-5xl">
                  ${quote.price.toFixed(2)}
                </div>
                <div
                  className={`mt-1 font-mono text-sm md:text-base ${
                    isPositive ? "text-rise" : "text-fall"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {quote.change.toFixed(2)} ({changePct.toFixed(2)}%)
                </div>
              </div>

              <div
                className="hidden h-[60px] w-px bg-white/10 md:block"
                aria-hidden
              />

              <div className="flex flex-wrap gap-4 md:contents">
              {[
                { label: "市场波动", value: `${(iv.iv30d * 100).toFixed(1)}%` },
                {
                  label: "历史分位",
                  value: `${iv.ivPercentile.toFixed(0)}`,
                },
                {
                  label: "IV Rank",
                  value: iv.ivRank.toFixed(0),
                },
                { label: "下次财报", value: iv.nextEarnings ?? "—" },
                {
                  label: "52周区间",
                  value: `${(iv.iv52wLow * 100).toFixed(0)}-${(iv.iv52wHigh * 100).toFixed(0)}%`,
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-slate-500">
                    {label}
                  </div>
                  <div className="font-mono text-lg font-medium text-slate-100">
                    {value}
                  </div>
                </div>
              ))}
              </div>

              <div className="mt-2 text-sm md:ml-auto md:mt-0">
                <Link href="/portfolio" className="btn-ghost text-xs">
                  <ArrowLeft size={14} />
                  返回 Portfolio
                </Link>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-3 py-4 pb-24 md:px-6 md:py-8 md:pb-10">
          <StockDetailClient
            ticker={tickerUpper}
            spot={quote.price}
            change={quote.change}
            iv={iv}
            optionsChain={optionsChain}
            strategyCards={strategyCards}
          />
        </main>
      </div>
    );
  }

  // 港股 / A 股 / 韩股 / 日欧等（MRF Top10 映射）：简版标的页，避免落入 QDII 分支 404
  if (isGlobalEquityTicker(tickerUpper)) {
    const quote = await fetchQuote(tickerUpper);
    return (
      <div className="min-h-screen bg-navy">
        <header className="border-b border-white/[0.07] px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link href="/mrf" className="inline-flex items-center gap-1.5 text-sm text-info hover:underline">
              <ArrowLeft size={14} /> MRF
            </Link>
            <h1 className="font-display text-lg font-semibold text-slate-100">{tickerUpper}</h1>
            <Link href="/portfolio" className="text-sm text-info hover:underline">
              Portfolio →
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl py-4 md:py-6">
          <GlobalEquityView ticker={tickerUpper} quote={quote} />
        </main>
      </div>
    );
  }

  // QDII 基金：显示净值曲线（需配置 Supabase；可选 NEXT_PUBLIC_SHOW_QDII 控制）
  if (!isSupabaseConfigured()) notFound();
  if (process.env.NEXT_PUBLIC_SHOW_QDII === "false") notFound();

  const fund = await getFundByCode(tickerUpper);
  if (!fund) notFound();

  const { dates, navs, latestNav, ytd } = await getNavHistory(
    fund.isin,
    fund.ccy
  );

  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-white/[0.07] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-info hover:underline">
            <ArrowLeft size={14} /> Portfolio
          </Link>
          <h1 className="font-display text-xl font-semibold text-slate-100">
            {tickerUpper} — QDII 基金
          </h1>
          <span />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-6 md:pb-10">
        <QdiiFundView
          code={tickerUpper}
          isin={fund.isin}
          ccy={fund.ccy}
          latestNav={latestNav}
          ytd={ytd}
          dates={dates}
          navs={navs}
        />
      </main>
    </div>
  );
}
