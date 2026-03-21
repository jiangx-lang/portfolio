"use client";

import Link from "next/link";
import type { Holding } from "@/types";
import { cn, formatPercent } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

interface HoldingsTableProps {
  holdings: Holding[];
}

const SECTOR_BADGE_COLORS: Record<string, string> = {
  Technology: "bg-info/20 text-info",
  "Communication Services": "bg-violet-500/20 text-violet-300",
  "Consumer Cyclical": "bg-amber-500/20 text-amber-300",
  Healthcare: "bg-emerald-500/20 text-emerald-300",
  Financials: "bg-cyan-500/20 text-cyan-300",
};

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const { isMobile } = useIsMobile();

  if (isMobile) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111827] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.65)]">
        {holdings.map((h, i) => (
          <Link
            key={h.ticker}
            href={`/stock/${h.ticker}`}
            className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white">
                <span className="mr-1.5 text-white/50">{i + 1}.</span>
                <span className="font-mono font-semibold text-info">{h.ticker}</span>
                <span className="ml-1.5 truncate text-[12px] text-white/80">{h.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">{h.sector}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-mono tabular-nums text-gain">{h.weight.toFixed(1)}%</div>
              <div
                className={cn(
                  "text-[11px] font-mono tabular-nums",
                  h.changePercent >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(h.changePercent)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] shadow-[0_16px_40px_rgba(0,0,0,0.65)]">
      <table className="w-full text-left text-xs md:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/60">
            <th className="p-3 font-medium">Ticker</th>
            <th className="p-3 font-medium">Weight %</th>
            <th className="p-3 font-medium">Price</th>
            <th className="p-3 font-medium">Day Chg</th>
            <th className="p-3 font-medium">P/E</th>
            <th className="p-3 font-medium">Sector</th>
            <th className="p-3 font-medium">YTD %</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr
              key={h.ticker}
              className="border-b border-white/5 transition hover:border-l-2 hover:border-l-[color:var(--accent-gold-dim)] hover:bg-[color:var(--bg-hover)]"
            >
              <td className="p-3">
                <Link
                  href={`/stock/${h.ticker}`}
                  className="font-mono font-semibold text-info hover:underline"
                >
                  {h.ticker}
                </Link>
              </td>
              <td className="p-3 font-mono tabular-nums text-white">{h.weight.toFixed(1)}%</td>
              <td className="p-3 font-mono tabular-nums text-white">${h.price.toFixed(2)}</td>
              <td
                className={cn(
                  "p-3 font-mono tabular-nums",
                  h.change >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(h.changePercent)}
              </td>
              <td className="p-3 font-mono tabular-nums text-white/80">
                {h.pe != null ? h.pe.toFixed(1) : "—"}
              </td>
              <td className="p-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    SECTOR_BADGE_COLORS[h.sector] ?? "bg-white/10 text-white/80"
                  )}
                >
                  {h.sector}
                </span>
              </td>
              <td
                className={cn(
                  "p-3 font-mono tabular-nums",
                  h.ytd >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(h.ytd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
