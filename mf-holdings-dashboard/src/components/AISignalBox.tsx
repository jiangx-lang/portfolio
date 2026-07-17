"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { AISignal, SignalLevel } from "@/types";
import { cn } from "@/lib/utils";

interface AISignalBoxProps {
  ticker: string;
  initial?: AISignal | null;
  ctx?: { price?: number; ivRank?: number; iv30d?: number; nextEarnings?: string };
}

const SIGNAL_BADGE: Record<SignalLevel, string> = {
  strong_buy: "badge badge-green",
  buy: "badge badge-blue",
  hold: "badge border border-white/15 bg-white/5 text-slate-300",
  trim: "badge badge-gold",
  sell: "badge badge-red",
};

const SIGNAL_LABEL_ZH: Record<SignalLevel, string> = {
  strong_buy: "积极关注",
  buy: "关注",
  hold: "中性",
  trim: "谨慎",
  sell: "高风险示意",
};

const VERDICT_LABEL: Record<string, string> = {
  attractive: "定价相对温和",
  fair: "定价中性",
  expensive: "定价偏紧",
};

function Progress({ value, barClass }: { value: number; barClass: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full rounded-full", barClass)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function AISignalBox({ ticker, initial, ctx }: AISignalBoxProps) {
  const [result, setResult] = useState<AISignal | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          analysisType: "stock",
          context: ctx ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">市场数据摘要</span>
          <p className="mt-2 truncate text-lg font-semibold text-white">
            {result?.headline || "点击生成数据摘要"}
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="btn-gold shrink-0 !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          {loading ? "生成中…" : result ? "重新生成" : "生成摘要"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rise">{error}</p>}
      {result && !loading && (
        <div className="mt-4 space-y-4 text-sm">
          {/* 板块1：数据标签 */}
          <div className="rounded-xl border border-white/[0.07] bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("!px-3 !py-1 !text-sm", SIGNAL_BADGE[result.signal])}>
                {SIGNAL_LABEL_ZH[result.signal]}
              </span>
              <span className="text-xs text-slate-400">置信度</span>
              <span className="w-28">
                <Progress value={Number(result.confidence ?? 50)} barClass="bg-fall" />
              </span>
              <span className="num text-xs text-slate-400">{result.confidence}%</span>
              {result.valuationVerdict && (
                <span className="badge badge-blue ml-auto">
                  估值：{VERDICT_LABEL[String(result.valuationVerdict)] || result.valuationVerdict}
                </span>
              )}
            </div>

            {result.valuationComment && <div className="mt-2 text-slate-200">{result.valuationComment}</div>}

            {result.priceTarget && (
              <div className="mt-3 rounded-lg border border-white/[0.07] bg-navy p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>情景假设区间（非承诺）</span>
                  <span className="font-mono text-slate-200">
                    Bull ${result.priceTarget.bull} · Base ${result.priceTarget.base} · Bear ${result.priceTarget.bear}
                  </span>
                </div>
                {result.priceTarget.explanation && <div className="mt-1 text-slate-400">{result.priceTarget.explanation}</div>}
              </div>
            )}
          </div>

          {/* 板块2：业务要点 */}
          <div className="rounded-xl border border-white/[0.07] bg-white/5 p-4">
            <div className="text-xs font-medium text-slate-400">业务与行业要点</div>
            <div className="mt-2 text-slate-100">{result.whyInvest || result.thesis}</div>
            {result.marketSentiment && (
              <div className="mt-3 rounded-lg border border-white/[0.07] bg-navy p-3 text-xs text-slate-300">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">波动环境说明</div>
                <div className="mt-1">{result.marketSentiment}</div>
              </div>
            )}
            {(result.timingExplanation || result.timingScore != null) && (
              <div className="mt-3 rounded-lg border border-white/[0.07] bg-navy p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>波动环境示意分</span>
                  <span className="font-mono text-slate-200">{Number(result.timingScore ?? 50)}</span>
                </div>
                <div className="mt-2">
                  <Progress value={Number(result.timingScore ?? 50)} barClass="bg-info" />
                </div>
                {result.timingExplanation && <div className="mt-2 text-slate-300">{result.timingExplanation}</div>}
              </div>
            )}
          </div>

          {/* 板块3：风险与策略 */}
          <div className="rounded-xl border border-white/[0.07] bg-white/5 p-4">
            <div className="text-xs font-medium text-slate-400">风险与策略</div>
            {result.keyRisks?.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-slate-300">
                {result.keyRisks.slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {result.simpleStrategy && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-white/[0.07] bg-navy p-3 text-xs text-slate-300">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">稳健型</div>
                  <div className="mt-1">{result.simpleStrategy.forConservative}</div>
                </div>
                <div className="rounded-lg border border-white/[0.07] bg-navy p-3 text-xs text-slate-300">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">成长型</div>
                  <div className="mt-1">{result.simpleStrategy.forGrowth}</div>
                </div>
              </div>
            )}
            {result.simpleStrategy?.optionSignal && (
              <div className="mt-2 text-xs text-slate-400">定价环境：{result.simpleStrategy.optionSignal}</div>
            )}
            <div className="mt-3 text-xs text-slate-500">
              免责声明：以上内容仅供信息参考，不构成任何投资建议。市场有风险，决策请咨询持牌专业人士。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
