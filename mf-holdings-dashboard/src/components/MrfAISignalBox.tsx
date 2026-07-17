"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

export interface MrfFundData {
  fund_name: string;
  brand: string;
  equity_pct: number;
  fixed_income_pct: number;
  cash_pct: number;
  fee_rate: number;
  holdings?: {
    holding_name_std?: string;
    holding_name_raw?: string | null;
    weight_pct: number;
    holding_type?: string;
  }[];
}

interface AIResult {
  signal: string;
  confidence: number;
  summary: string;
  thesis: string;
  strengths: string[];
  risks: string[];
  fee_assessment: string;
  suitable_investor: string;
  allocation_comment: string;
  recommendation: string;
}

type CachedRow = AIResult & { generated_at?: string };

const SIGNAL_BADGE: Record<string, string> = {
  strong_buy: "badge badge-green",
  buy: "badge badge-blue",
  hold: "badge border border-white/15 bg-white/5 text-slate-300",
  trim: "badge badge-gold",
  sell: "badge badge-red",
};

const SIGNAL_LABEL: Record<string, string> = {
  strong_buy: "积极关注",
  buy: "关注",
  hold: "中性",
  trim: "谨慎",
  sell: "高风险示意",
};

function signalBadge(sig: string): string {
  return SIGNAL_BADGE[sig] || "badge border border-white/15 bg-white/5 text-slate-300";
}

export default function MrfAISignalBox({ fund }: { fund: MrfFundData }) {
  const [result, setResult] = useState<AIResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fundKey = useMemo(() => fund.fund_name?.trim() || "", [fund.fund_name]);

  useEffect(() => {
    let cancelled = false;
    async function loadCache() {
      if (!fundKey) return;
      try {
        const res = await fetch(`/api/analysis/${encodeURIComponent(fundKey)}?fund_type=MRF`);
        const data = (await res.json()) as CachedRow | null;
        if (cancelled) return;
        if (data && data.summary) {
          const { generated_at, ...rest } = data;
          setResult(rest);
          setGeneratedAt(generated_at ? String(generated_at) : "");
        } else {
          setResult(null);
          setGeneratedAt("");
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          setGeneratedAt("");
        }
      }
    }
    loadCache();
    return () => {
      cancelled = true;
    };
  }, [fundKey]);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const holdings = (fund.holdings ?? []).slice(0, 5).map((h) => ({
        name: h.holding_name_std || h.holding_name_raw || "",
        weight_pct: h.weight_pct,
        holding_type: h.holding_type,
      }));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType: "mrf_fund",
          fundData: {
            fund_name: fund.fund_name,
            brand: fund.brand,
            equity_pct: fund.equity_pct,
            fixed_income_pct: fund.fixed_income_pct,
            cash_pct: fund.cash_pct,
            fee_rate: fund.fee_rate,
            holdings,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(typeof data.error === "string" ? data.error : "分析失败，请重试");
        setResult(null);
        return;
      }
      if (data.thesis && data.keyRisks && !data.summary) {
        setError("当前返回格式异常，请检查 QWEN_API_KEY 与 analysisType");
        setResult(null);
        return;
      }
      const ai = data as AIResult;
      setResult(ai);

      // 写入缓存（Supabase fund_ai_analysis）
      try {
        const saveRes = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fund_code: fundKey,
            fund_type: "MRF",
            fund_name: fundKey,
            ...ai,
          }),
        });
        const saved = (await saveRes.json()) as { generated_at?: string } | null;
        if (saveRes.ok && saved?.generated_at) setGeneratedAt(String(saved.generated_at));
      } catch {
        // ignore cache write errors
      }
    } catch {
      setError("分析失败，请重试");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card mt-4 p-5">
      <span className="eyebrow">基金公开信息摘要</span>

      {!result && !loading && (
        <button type="button" className="btn-gold mt-3 !px-4 !py-2 text-[13px]" onClick={analyze}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          生成摘要
        </button>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
          生成中，请稍候…
        </div>
      )}

      {error && <div className="mt-3 text-[13px] text-rise">{error}</div>}

      {result && (
        <div className="mt-3">
          {generatedAt && (
            <div className="mb-2 text-[11px] text-slate-500">
              上次生成时间：<span className="num">{String(generatedAt).replace("T", " ").slice(0, 19)}</span>
            </div>
          )}
          <div className="mb-3 flex items-center gap-3">
            <span className={signalBadge(result.signal)}>{SIGNAL_LABEL[result.signal] || result.signal}</span>
            <span className="text-xs text-slate-400">
              置信度 <span className="num">{result.confidence}%</span>
            </span>
            <button
              type="button"
              className="btn-ghost ml-auto !px-2.5 !py-1 text-[11px]"
              onClick={analyze}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              重新生成
            </button>
          </div>

          <div className="mb-3 border-l-2 border-info pl-3 text-sm leading-relaxed text-slate-100">
            {result.summary}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">策略说明</div>
              <div className="text-[13px] leading-normal text-slate-100">{result.thesis}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">风险特征（标签）</div>
              <div className="text-[13px] leading-normal text-slate-100">{result.suitable_investor}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">核心优势</div>
              <ul className="m-0 list-disc pl-4 text-[13px] leading-[1.7] text-slate-100">
                {result.strengths?.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">主要风险</div>
              <ul className="m-0 list-disc pl-4 text-[13px] leading-[1.7] text-slate-100">
                {result.risks?.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">费率评价</div>
              <div className="text-[13px] leading-normal text-slate-100">{result.fee_assessment}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">配置点评</div>
              <div className="text-[13px] leading-normal text-slate-100">{result.allocation_comment}</div>
            </div>
          </div>

          <div className="mt-2.5 rounded-xl border-l-2 border-info bg-info/10 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">数据观察要点</div>
            <div className="text-[13px] leading-relaxed text-slate-100">{result.recommendation}</div>
          </div>
        </div>
      )}
    </div>
  );
}
