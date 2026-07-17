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
    <div>
      <p className="mb-2 text-sm font-medium text-slate-300">
        期权报价链 · <span className="text-info">ATM 蓝色标记</span> / <span className="text-fall">ITM 绿色标记</span>
      </p>
      <div className="atlas-table-wrap">
        <table className="atlas-table min-w-[720px]">
          <thead>
            <tr>
              <th>Strike</th>
              <th>Call Bid</th>
              <th>Call Ask</th>
              <th>Call IV</th>
              <th>Delta</th>
              <th>Theta</th>
              <th>Put Bid</th>
              <th>Put Ask</th>
              <th>Put IV</th>
              <th>Put Δ</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {strikes.map((strike) => {
              const c = calls.find((x) => x.strike === strike);
              const p = puts.find((x) => x.strike === strike);
              const atm = isATM(strike);
              const rowClass = cn(
                atm && "border-l-2 border-info bg-info/10",
                !atm && c && isITM(strike, "call") && "bg-fall/5",
                !atm && p && isITM(strike, "put") && "bg-fall/5"
              );
              const cellBtn = (active: boolean) =>
                cn(
                  "w-full rounded px-2 py-1 text-left transition",
                  "hover:bg-white/5",
                  active && "bg-gold/10 ring-1 ring-gold/60"
                );
              return (
                <tr key={strike} className={rowClass}>
                  <td className="text-slate-100">{strike}</td>
                  <td>
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
                  <td>{c?.ask.toFixed(2) ?? "—"}</td>
                  <td className="text-slate-400">{c ? `${(c.iv * 100).toFixed(1)}%` : "—"}</td>
                  <td className="text-slate-400">{c?.delta.toFixed(2) ?? "—"}</td>
                  <td className="text-slate-400">{c?.theta.toFixed(3) ?? "—"}</td>
                  <td>
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
                  <td>{p?.ask.toFixed(2) ?? "—"}</td>
                  <td className="text-slate-400">{p ? `${(p.iv * 100).toFixed(1)}%` : "—"}</td>
                  <td className="text-slate-400">{p?.delta.toFixed(2) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
