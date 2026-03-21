"use client";

import type { OptionsContract } from "@/types";
import { cn } from "@/lib/utils";

interface OptionsChainProps {
  contracts: OptionsContract[];
  spot: number;
  selected?: OptionsContract | null;
  onSelectContract?: (c: OptionsContract) => void;
}

export function OptionsChain({ contracts, spot, selected, onSelectContract }: OptionsChainProps) {
  const calls = contracts.filter((c) => c.type === "call").sort((a, b) => a.strike - b.strike);
  const puts = contracts.filter((c) => c.type === "put").sort((a, b) => a.strike - b.strike);
  const strikes = Array.from(new Set(contracts.map((c) => c.strike))).sort((a, b) => a - b);

  function isATM(s: number) {
    return Math.abs(s - spot) < 3;
  }
  function isITM(s: number, type: "call" | "put") {
    return type === "call" ? s < spot : s > spot;
  }
  function isSelected(c?: OptionsContract) {
    if (!c || !selected) return false;
    return c.type === selected.type && c.strike === selected.strike && c.expiry === selected.expiry;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-navy-card">
      <p className="border-b border-white/10 p-3 text-sm font-medium text-white/80">
        Options chain (ATM blue, ITM green)
      </p>
      <table className="w-full min-w-[720px] text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-white/60">
            <th className="p-2">Strike</th>
            <th className="p-2">Call Bid</th>
            <th className="p-2">Call Ask</th>
            <th className="p-2">Call IV</th>
            <th className="p-2">Delta</th>
            <th className="p-2">Theta</th>
            <th className="p-2">Put Bid</th>
            <th className="p-2">Put Ask</th>
            <th className="p-2">Put IV</th>
            <th className="p-2">Put Δ</th>
          </tr>
        </thead>
        <tbody>
          {strikes.map((strike) => {
            const c = calls.find((x) => x.strike === strike);
            const p = puts.find((x) => x.strike === strike);
            const atm = isATM(strike);
            const rowClass = cn(
              "border-b border-white/5",
              atm && "border-l-2 border-info bg-info/10",
              !atm && c && isITM(strike, "call") && "bg-gain/5",
              !atm && p && isITM(strike, "put") && "bg-gain/5"
            );
            const cellBtn = (active: boolean) =>
              cn(
                "w-full rounded px-2 py-1 text-left transition",
                "hover:bg-white/5",
                active && "ring-1 ring-info bg-info/10"
              );
            return (
              <tr key={strike} className={rowClass}>
                <td className="p-2 font-mono text-white">{strike}</td>
                <td className="p-2 text-white/90">
                  <button
                    type="button"
                    disabled={!c}
                    className={cn(
                      cellBtn(!!c && isSelected(c)),
                      !c && "cursor-not-allowed opacity-60 hover:bg-transparent"
                    )}
                    onClick={() => (c ? onSelectContract?.(c) : null)}
                  >
                    {c ? c.bid.toFixed(2) : "—"}
                  </button>
                </td>
                <td className="p-2 text-white/90">{c?.ask.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-white/70">{c ? `${(c.iv * 100).toFixed(1)}%` : "—"}</td>
                <td className="p-2 text-white/70">{c?.delta.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-white/70">{c?.theta.toFixed(3) ?? "—"}</td>
                <td className="p-2 text-white/90">
                  <button
                    type="button"
                    disabled={!p}
                    className={cn(
                      cellBtn(!!p && isSelected(p)),
                      !p && "cursor-not-allowed opacity-60 hover:bg-transparent"
                    )}
                    onClick={() => (p ? onSelectContract?.(p) : null)}
                  >
                    {p ? p.bid.toFixed(2) : "—"}
                  </button>
                </td>
                <td className="p-2 text-white/90">{p?.ask.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-white/70">{p ? `${(p.iv * 100).toFixed(1)}%` : "—"}</td>
                <td className="p-2 text-white/70">{p?.delta.toFixed(2) ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
