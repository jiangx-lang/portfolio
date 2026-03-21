"use client";

import { useMemo, useState } from "react";
import type { Holding } from "@/types";

type PortfolioAIResult = {
  overallSignal: "buy" | "hold" | "trim";
  portfolioComment: string;
  topPicks: { ticker: string; reason: string }[];
  mainRisk: string;
  optionsPerspective: string;
  recommendation: string;
};

export function PortfolioAIAnalysis({ holdings }: { holdings: Holding[] }) {
  const [result, setResult] = useState<PortfolioAIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const top10 = useMemo(
    () =>
      (holdings ?? []).slice(0, 10).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: h.weight,
        ytd: h.ytd,
        signal: h.signal,
      })),
    [holdings]
  );

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: "PORTFOLIO_TOP10",
          analysisType: "portfolio",
          context: {
            holdings: top10,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data as PortfolioAIResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-navy-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-white/60">持仓数据概览</div>
          <div className="mt-1 text-sm text-white/70">持仓结构与市场数据参考</div>
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={loading}
          className="rounded bg-info/20 px-3 py-1.5 text-xs font-medium text-info hover:bg-info/30 disabled:opacity-50"
        >
          {loading ? "生成中…" : result ? "重新生成" : "生成概览"}
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-loss">{error}</div>}

      {result && (
        <div className="mt-4 space-y-3 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/5 px-2 py-1 text-xs text-white/70">数据标签</span>
            <span className="text-sm font-semibold text-white">
              {result.overallSignal === "buy"
                ? "关注"
                : result.overallSignal === "trim"
                  ? "谨慎"
                  : "中性"}
            </span>
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-3">{result.portfolioComment}</div>

          {result.topPicks?.length > 0 && (
            <div>
              <div className="text-xs text-white/50">权重较高标的 · 数据摘要</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {result.topPicks.slice(0, 3).map((p, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-[#0a0e1a] p-3 text-xs text-white/70">
                    <div className="font-mono text-white/90">{p.ticker}</div>
                    <div className="mt-1">{p.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">最大风险</div>
            <div className="mt-1">{result.mainRisk}</div>
          </div>

          <div className="rounded border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">市场波动数据视角</div>
            <div className="mt-1">{result.optionsPerspective}</div>
          </div>

          <div className="rounded border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">数据摘要</div>
            <div className="mt-1">{result.recommendation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

