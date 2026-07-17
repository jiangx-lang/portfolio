"use client";

import { useMemo, useState } from "react";
import type { AISignal, OptionsContract } from "@/types";
import { cn } from "@/lib/utils";

const SIGNAL_COLORS: Record<string, string> = {
  strong_buy: "text-rise border-rise",
  buy: "text-rise border-rise/70",
  hold: "text-slate-300 border-white/40",
  trim: "text-fall border-fall/70",
  sell: "text-fall border-fall",
};

export function OptionsAIBox({
  ticker,
  spot,
  ivRank,
  contract,
}: {
  ticker: string;
  spot: number;
  ivRank: number;
  contract: OptionsContract | null;
}) {
  const [result, setResult] = useState<AISignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const headline = useMemo(() => {
    if (!contract) return "";
    const t = contract.type === "call" ? "C" : "P";
    return `${ticker} ${contract.expiry} $${contract.strike}${t}`;
  }, [contract, ticker]);

  async function analyze() {
    if (!contract) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          analysisType: "options",
          context: {
            price: spot,
            ivRank,
            iv30d: Number((contract.iv * 100).toFixed(1)),
            nextEarnings: undefined,
            contract,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data as AISignal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  if (!contract) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-navy-card p-4 text-sm text-slate-400">
        点击期权报价链里的 Call/Put Bid 选择一个合约，然后在这里生成合约级 AI 策略建议。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-navy-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Options AI</h3>
          <p className="mt-1 font-mono text-xs text-slate-500">{headline}</p>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold-light transition hover:bg-gold/20 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-400">
        <div>Type: {contract.type}</div>
        <div>Expiry: {contract.expiry}</div>
        <div>Strike: ${contract.strike}</div>
        <div>
          Bid/Ask: {contract.bid.toFixed(2)} / {contract.ask.toFixed(2)}
        </div>
        <div>IV: {(contract.iv * 100).toFixed(1)}%</div>
        <div>IV Rank: {ivRank.toFixed(0)}</div>
        <div>Δ: {contract.delta.toFixed(2)}</div>
        <div>Θ: {contract.theta.toFixed(3)}</div>
      </div>

      {error && <p className="mt-3 text-sm text-rise">{error}</p>}

      {result && !loading && (
        <div className="mt-3 space-y-2 text-sm">
          <p className={cn("rounded border px-2 py-1 font-medium capitalize", SIGNAL_COLORS[result.signal])}>
            {result.signal.replace("_", " ")} · <span className="font-mono">{result.confidence}%</span> confidence
          </p>
          <p className="text-slate-300">{result.thesis}</p>
          {result.keyRisks?.length > 0 && (
            <ul className="list-inside list-disc text-slate-400">
              {result.keyRisks.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {result.optionsStrategy && (
            <div className="rounded border border-white/[0.07] bg-white/[0.03] p-2 text-xs">
              <p className="font-medium text-slate-200">{result.optionsStrategy.recommended}</p>
              <p className="text-slate-400">{result.optionsStrategy.rationale}</p>
              <p className="mt-1 font-mono text-slate-500">
                Expiry {result.optionsStrategy.expiry} · MaxProfit {result.optionsStrategy.maxProfit} · MaxLoss{" "}
                {result.optionsStrategy.maxLoss} · BE {result.optionsStrategy.breakeven}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

