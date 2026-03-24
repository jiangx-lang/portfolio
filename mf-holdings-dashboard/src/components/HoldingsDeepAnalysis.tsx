"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { DeepAnalysisResult, MarketDataRow, RiskFlag } from "@/lib/fundDeepAnalysisGroq";

export interface HoldingInput {
  ticker?: string;
  name: string;
  weight: number;
  type: string;
}

interface Props {
  fundName: string;
  holdings: HoldingInput[];
  /** 报告页眉展示，如 QD 产品代码 */
  productCode?: string;
}

function Tooltip({ children, tip }: { children: ReactNode; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "block", width: "100%" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 8,
            background: "#0f2744",
            border: "1px solid #3b82f6",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#cbd5e1",
            lineHeight: 1.6,
            width: "min(280px, 92vw)",
            maxWidth: 320,
            zIndex: 999,
            whiteSpace: "pre-line",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

const NON_YF_TICKERS = new Set(["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"]);

const cardShell: CSSProperties = {
  background: "#0d1b2e",
  border: "1px solid #1e3a5f",
  borderRadius: 8,
  padding: 12,
  height: "100%",
};

function scoreTextClass(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

function flagClass(t: RiskFlag["type"]): string {
  switch (t) {
    case "danger":
      return "bg-red-500/20 text-red-300 border border-red-500/40";
    case "warning":
      return "bg-amber-500/15 text-amber-200 border border-amber-500/35";
    case "success":
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-500/35";
    case "info":
      return "bg-sky-500/15 text-sky-200 border border-sky-500/35";
    default:
      return "bg-slate-600/30 text-slate-300 border border-slate-500/40";
  }
}

function peBadge(pe: number | null | undefined): { text: string; cls: string } {
  if (pe == null || Number.isNaN(pe)) return { text: "—", cls: "bg-slate-600/40 text-slate-400" };
  if (pe < 12) return { text: "偏低", cls: "bg-emerald-500/20 text-emerald-300" };
  if (pe < 22) return { text: "中性", cls: "bg-amber-500/20 text-amber-200" };
  return { text: "偏贵", cls: "bg-red-500/20 text-red-300" };
}

function peBarWidth(pe: number | null | undefined): number {
  if (pe == null || Number.isNaN(pe)) return 8;
  return Math.min(100, Math.max(6, (pe / 45) * 100));
}

const BAR_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316"];

export default function HoldingsDeepAnalysis({ fundName, holdings, productCode }: Props) {
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataRow[]>([]);
  const [analysis, setAnalysis] = useState<DeepAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "running" | "done">("idle");

  const equityHoldings = holdings.filter(
    (h) => h.type === "equity" && h.ticker && h.ticker.length > 0 && !NON_YF_TICKERS.has(h.ticker)
  );

  const todayStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  async function runAnalysis() {
    if (equityHoldings.length === 0) {
      setError("无可分析的股票持仓（需要 equity 类型且可映射到 yfinance 标的代码）");
      return;
    }

    setLoading(true);
    setError("");
    setStep("running");

    try {
      const payload = {
        fundName,
        holdings: equityHoldings.map((h) => ({ ticker: h.ticker as string, weight: h.weight })),
      };

      const res = await fetch("/api/holdings-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || data?.detail || "请求失败");
        setStep("idle");
        return;
      }

      setMarketData(Array.isArray(data.marketData) ? data.marketData : []);
      setAnalysis((data.analysis as DeepAnalysisResult) ?? null);
      setStep("done");
    } catch {
      setError(
        "分析失败，请重试（请确认已安装 Python 依赖：`pip install -r scripts/requirements-market.txt`，含 yfinance / akshare）"
      );
      setStep("idle");
    } finally {
      setLoading(false);
    }
  }

  const showResults = !!analysis;
  const wm = analysis?.weightedMetrics;
  const scores = analysis?.scores;
  const conc = analysis?.concentration;
  const ai = analysis?.aiInsights;

  const sortedForMatrix = [...(analysis?.holdingsDetail ?? marketData)].filter(
    (d) => !d.error && (d.weight ?? 0) > 0
  );
  sortedForMatrix.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #1e3a5f", paddingTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ color: "#e2e8f0", fontSize: 16, margin: 0 }}>📊 持仓深度分析</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
            一页纸投研：服务端四维评分与集中度 → 通义千问精简解读（可选）；Python{" "}
            <code style={{ fontSize: 11 }}>fetch_market_data.py</code> 并行抓取 + 按日缓存
          </p>
        </div>
        {step === "idle" && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={equityHoldings.length === 0}
            style={{
              background: "#0f2744",
              color: "#60a5fa",
              border: "1px solid #3b82f6",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: equityHoldings.length === 0 ? "not-allowed" : "pointer",
              opacity: equityHoldings.length === 0 ? 0.5 : 1,
            }}
          >
            运行分析
          </button>
        )}
      </div>

      {loading && step === "running" && (
        <div style={{ color: "#94a3b8", fontSize: 13, padding: "16px 0" }}>
          ⏳ 正在抓取市场数据（并行 + 缓存）并生成投研页（约 10–40 秒，美股期权链较慢）…
        </div>
      )}

      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

      {showResults && scores && wm && conc && (
        <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-4 text-slate-200">
          {/* 页眉 */}
          <div className="mb-5 flex flex-col justify-between gap-3 border-b border-slate-700 pb-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-medium text-white">{fundName}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {(productCode && productCode.trim()) || "—"} · {todayStr} · Top {sortedForMatrix.length} 持仓
              </p>
            </div>
            <div className="text-right sm:ml-auto">
              <div className={`text-4xl font-semibold ${scoreTextClass(scores.overall)}`}>{scores.overall}</div>
              <div className="mt-1 text-xs text-slate-500">综合评分 / 100</div>
            </div>
          </div>

          {/* 四维评分 */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["估值", scores.valuation, scores.valuationLabel],
                ["情绪", scores.sentiment, scores.sentimentLabel],
                ["风险", scores.risk, scores.riskLabel],
                ["质量", scores.quality, scores.qualityLabel],
              ] as const
            ).map(([title, val, label]) => (
              <div key={title} className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
                <div className="text-[11px] text-slate-500">{title}</div>
                <div className={`text-2xl font-semibold ${scoreTextClass(val)}`}>{val}</div>
                <div className="mt-1 text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          {/* 加权指标 */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {[
              ["加权 PE", wm.pe != null ? `${wm.pe.toFixed(1)}x` : "—"],
              ["加权 PB", wm.pb != null ? wm.pb.toFixed(2) : "—"],
              ["加权 IV", wm.ivPct != null ? `${wm.ivPct.toFixed(1)}%` : "—"],
              ["加权 PCR", wm.pcr != null ? wm.pcr.toFixed(2) : "—"],
              ["股息率", wm.dividendYield != null ? `${wm.dividendYield.toFixed(2)}%` : "—"],
              ["Beta", wm.beta != null ? wm.beta.toFixed(2) : "—"],
            ].map(([k, v]) => (
              <Tooltip key={k} tip={`${k}：由有数据成分按权重计算；缺失市场常无 IV/期权。`}>
                <div style={{ ...cardShell, cursor: "help" }} className="!p-2">
                  <div className="text-[11px] text-slate-500">{k}</div>
                  <div className="text-lg font-semibold text-slate-100">{v}</div>
                </div>
              </Tooltip>
            ))}
          </div>

          {/* 持仓信号矩阵 */}
          <div className="mb-5">
            <h4 className="mb-2 text-sm font-medium text-slate-300">持仓信号矩阵</h4>
            <div className="space-y-2">
              {sortedForMatrix.map((d) => {
                const pe = d.pe_ttm != null ? Number(d.pe_ttm) : null;
                const badge = peBadge(pe);
                const label = (d.name || d.ticker || "—") as string;
                return (
                  <div
                    key={`${d.ticker}-${label}`}
                    className="flex flex-col gap-1 rounded border border-slate-700/50 bg-slate-900/30 px-3 py-2 sm:flex-row sm:items-center"
                  >
                    <div className="w-full shrink-0 text-sm text-slate-200 sm:w-44">
                      <span className="font-medium">{d.ticker}</span>
                      <span className="ml-2 truncate text-xs text-slate-500">{label}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-400"
                          style={{ width: `${peBarWidth(pe)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:justify-end">
                      <span className="text-xs text-slate-400">PE {pe != null ? pe.toFixed(1) : "—"}</span>
                      <span className={`rounded px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 集中度 */}
          <div className="mb-5">
            <h4 className="mb-2 text-sm font-medium text-slate-300">持仓集中度</h4>
            <div className="flex h-8 w-full overflow-hidden rounded-md bg-slate-800">
              {sortedForMatrix.map((d, i) => {
                const pct = (d.weight ?? 0) * 100;
                const flexGrow = Math.max(d.weight ?? 0, 0.002);
                return (
                  <div
                    key={`bar-${d.ticker}-${i}`}
                    title={`${d.ticker} ${pct.toFixed(1)}%`}
                    style={{
                      flex: `${flexGrow} 1 0`,
                      minWidth: 3,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Top4 合计 {(conc.top4Weight * 100).toFixed(1)}% · Top10 合计 {(conc.top10Weight * 100).toFixed(1)}% · HHI{" "}
              {conc.hhi.toFixed(1)} · 有效持仓数（1/Σw²）{conc.effectiveN.toFixed(2)}
            </p>
          </div>

          {/* 风险标志 */}
          {analysis.riskFlags.length > 0 && (
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-medium text-slate-300">风险与信号标签</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.riskFlags.map((f, i) => (
                  <span key={i} className={`rounded-full px-2.5 py-1 text-xs ${flagClass(f.type)}`}>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI 解读 */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <h4 className="mb-3 text-sm font-medium text-sky-200/90">AI 投研解读</h4>
            {!ai ? (
              <p className="text-sm text-slate-500">
                AI 解读暂不可用（未配置 QWEN_API_KEY、模型错误或解析失败）。数值评分与上图仍可供参考。
                {analysis.llmError ? (
                  <span className="mt-1 block text-xs text-slate-600">详情：{analysis.llmError}</span>
                ) : null}
              </p>
            ) : (
              <div className="space-y-3 text-sm leading-relaxed text-slate-300">
                <section>
                  <div className="text-xs font-medium text-slate-500">估值结论</div>
                  <p>{ai.valuationConclusion}</p>
                </section>
                <section>
                  <div className="text-xs font-medium text-slate-500">情绪与期权</div>
                  <p>{ai.sentimentSignal}</p>
                </section>
                <section>
                  <div className="text-xs font-medium text-slate-500">顾问式观察（非买卖指令）</div>
                  <p>{ai.advisorRecommendation}</p>
                </section>
                <section>
                  <div className="text-xs font-medium text-slate-500">核心风险</div>
                  <p className="whitespace-pre-wrap">{ai.keyRisks}</p>
                </section>
                <section>
                  <div className="text-xs font-medium text-slate-500">宏观与背景</div>
                  <p>{ai.marketContext}</p>
                </section>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setAnalysis(null);
              setMarketData([]);
              setStep("idle");
              setError("");
            }}
            style={{
              marginTop: 16,
              background: "transparent",
              color: "#475569",
              border: "1px solid #1e3a5f",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            重新分析
          </button>
        </div>
      )}

      {marketData.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ color: "#64748b", fontSize: 12, cursor: "pointer" }}>查看个股原始数据</summary>
          <table style={{ width: "100%", fontSize: 12, marginTop: 8, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left" }}>
                <th style={{ padding: "4px 8px" }}>股票</th>
                <th style={{ padding: "4px 8px" }}>详情</th>
                <th style={{ padding: "4px 8px" }}>权重</th>
                <th style={{ padding: "4px 8px" }}>PE</th>
                <th style={{ padding: "4px 8px" }}>PB</th>
                <th style={{ padding: "4px 8px" }}>IV</th>
                <th style={{ padding: "4px 8px" }}>PCR</th>
                <th style={{ padding: "4px 8px" }}>股息%</th>
                <th style={{ padding: "4px 8px" }}>缓存</th>
                <th style={{ padding: "4px 8px" }}>数据源</th>
                <th style={{ padding: "4px 8px" }}>质量</th>
              </tr>
            </thead>
            <tbody>
              {marketData.map((d, i) => (
                <tr key={i} style={{ borderTop: "1px solid #1e3a5f", color: d.error ? "#475569" : "#e2e8f0" }}>
                  <td style={{ padding: "4px 8px" }}>{d.ticker}</td>
                  <td style={{ padding: "4px 8px" }}>
                    {d.ticker && !d.error ? (
                      <Link
                        href={`/stock/${encodeURIComponent(String(d.ticker))}`}
                        style={{ color: "#60a5fa", fontSize: 12 }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        打开
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "4px 8px" }}>{((d.weight ?? 0) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "4px 8px" }}>{d.pe_ttm != null ? Number(d.pe_ttm).toFixed(1) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{d.pb != null ? Number(d.pb).toFixed(2) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>
                    {d.implied_volatility != null ? `${(Number(d.implied_volatility) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "4px 8px" }}>{d.put_call_ratio != null ? Number(d.put_call_ratio).toFixed(2) : "—"}</td>
                  <td style={{ padding: "4px 8px" }}>
                    {d.dividend_yield != null ? Number(d.dividend_yield).toFixed(2) : "—"}
                  </td>
                  <td style={{ padding: "4px 8px" }}>{d.cached ? "是" : "—"}</td>
                  <td style={{ padding: "4px 8px", fontSize: 11 }}>{d.data_source ?? "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{d.data_quality ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p style={{ color: "#475569", fontSize: 11, marginTop: 12 }}>
        四维评分与集中度由服务端根据公开行情计算；AI 部分为解读辅助。仅供参考，不构成投资建议。
      </p>
    </div>
  );
}
