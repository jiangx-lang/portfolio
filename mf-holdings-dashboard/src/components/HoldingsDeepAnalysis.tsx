"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BarChart3, Loader2, RefreshCw, Sparkles } from "lucide-react";
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
      className="relative block w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-[999] mb-2 w-[min(280px,92vw)] max-w-80 -translate-x-1/2 whitespace-pre-line rounded-lg border border-info/40 bg-navy-elevated px-3.5 py-2.5 text-xs leading-relaxed text-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          {tip}
        </div>
      )}
    </div>
  );
}

const NON_YF_TICKERS = new Set(["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"]);

function scoreTextClass(score: number): string {
  if (score >= 75) return "text-fall";
  if (score >= 55) return "text-gold";
  return "text-rise";
}

function flagClass(t: RiskFlag["type"]): string {
  switch (t) {
    case "danger":
      return "badge badge-red";
    case "warning":
      return "badge badge-gold";
    case "success":
      return "badge badge-green";
    case "info":
      return "badge badge-blue";
    default:
      return "badge border border-white/15 bg-white/5 text-slate-300";
  }
}

function peBadge(pe: number | null | undefined): { text: string; cls: string } {
  if (pe == null || Number.isNaN(pe))
    return { text: "—", cls: "badge border border-white/10 bg-white/5 text-slate-400" };
  if (pe < 12) return { text: "偏低", cls: "badge badge-green" };
  if (pe < 22) return { text: "中性", cls: "badge badge-gold" };
  return { text: "偏贵", cls: "badge badge-red" };
}

function peBarWidth(pe: number | null | undefined): number {
  if (pe == null || Number.isNaN(pe)) return 8;
  return Math.min(100, Math.max(6, (pe / 45) * 100));
}

/** 集中度色盘：镜像 DESIGN_SYSTEM 令牌（金 / 蓝 / 石板），供堆叠条按序号取色 */
const BAR_COLORS = [
  "#C9A84C", // gold
  "#5B93F0", // info
  "#94A3B8", // slate-400
  "#9A7E2F", // gold-dark
  "#2F66C4", // primary
  "#64748B", // slate-500
  "#E3C87A", // gold-light
  "#475569", // slate-600
];

/** 从“英伟达 NVDA / 腾讯 0700.HK / 茅台 600519.SH”等字符串末尾提取 ticker；仅作展示层兜底 */
function extractTickerFromName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/\b([A-Z0-9]{1,6}(?:\.[A-Z]{1,4})?)\b/g);
  if (!m || m.length === 0) return "";
  return m[m.length - 1];
}

function parseSafeWeight(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const strVal = String(val).trim().replace("%", "");
  const parsed = Number.parseFloat(strVal);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function tickerKey(val: unknown): string {
  return String(val ?? "").trim().toUpperCase();
}

function normalizeName(row: any): string {
  return String(row?.name ?? row?.holding_name_std ?? row?.holding_name_raw ?? row?.holding_name ?? "").trim();
}

function normalizeTicker(row: any): string {
  const t = String(row?.ticker ?? "").trim();
  if (t) return t;
  return extractTickerFromName(normalizeName(row));
}

function findByTicker<T extends { ticker?: string }>(rows: T[], ticker: string): T | undefined {
  if (!ticker) return undefined;
  const k = tickerKey(ticker);
  return rows.find((r) => tickerKey(r?.ticker) === k);
}

function normalizeWeight01(row: any): number {
  let w = parseSafeWeight(row?.weight ?? row?.weight_pct);
  if (w > 1) w = w / 100;
  if (!Number.isFinite(w) || w < 0) return 0;
  return w;
}

function toNormalizedMarketRow(row: any): MarketDataRow {
  return {
    ...row,
    name: normalizeName(row) || undefined,
    ticker: normalizeTicker(row) || undefined,
    weight: normalizeWeight01(row),
  } as MarketDataRow;
}

export default function HoldingsDeepAnalysis({ fundName, holdings, productCode }: Props) {
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<MarketDataRow[]>([]);
  const [analysis, setAnalysis] = useState<DeepAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "running" | "done">("idle");

  const equityHoldings = holdings.filter(
    (h) => h.type === "equity" && h.ticker && h.ticker.length > 0 && !NON_YF_TICKERS.has(h.ticker)
  );

  if (equityHoldings.length < 2) {
    return (
      <div className="mt-6 border-t border-white/[0.07] pt-5">
        <h3 className="flex items-center gap-2 font-display text-lg text-slate-100">
          <BarChart3 className="h-4 w-4 text-gold" aria-hidden />
          持仓深度分析
        </h3>
        <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-slate-400">
          本基金持仓以债券或非上市资产为主（当前{" "}
          <span className="num text-slate-300">{equityHoldings.length}</span>{" "}
          只股票持仓可映射到公开市场数据），样本过少，暂不展示持仓深度分析，避免误导。
        </p>
      </div>
    );
  }

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

  const baseRows: MarketDataRow[] = (holdings || []).map((h: any) => {
    const rawName = normalizeName(h);
    const ticker = normalizeTicker(h);
    let w = parseSafeWeight(h?.weight ?? h?.weight_pct);
    if (w > 1) w = w / 100;
    return {
      ...h,
      name: rawName || undefined,
      ticker: ticker || undefined,
      weight: Number.isFinite(w) ? w : 0,
    } as MarketDataRow;
  });

  const analysisRows: MarketDataRow[] = (analysis?.holdingsDetail ?? []).map((a) => toNormalizedMarketRow(a));
  const marketRows: MarketDataRow[] = (marketData ?? []).map((m) => toNormalizedMarketRow(m));

  const sourceRows: MarketDataRow[] = baseRows.map((baseItem) => {
    const matchedAnalysis = findByTicker(analysisRows, baseItem.ticker ?? "") ?? {};
    const matchedMarket = findByTicker(marketRows, baseItem.ticker ?? "") ?? {};
    return {
      ...matchedMarket,
      ...matchedAnalysis,
      ...baseItem,
    } as MarketDataRow;
  });

  const sortedForMatrix = sourceRows.filter((d) => {
    const w = Number(d.weight ?? 0);
    const hasName = String(d.name ?? "").trim().length > 0;
    const hasTicker = String(d.ticker ?? "").trim().length > 0;
    return w > 0 && (hasName || hasTicker);
  });
  sortedForMatrix.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  console.log("[Debug] Base Rows (parsed):", baseRows);
  console.log("[Debug] Sorted Matrix (filtered):", sortedForMatrix);

  return (
    <div className="mt-6 border-t border-white/[0.07] pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg text-slate-100">
            <BarChart3 className="h-4 w-4 text-gold" aria-hidden />
            持仓深度分析
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            一页纸投研：服务端四维评分与集中度 → 通义千问精简解读（可选）；Python{" "}
            <code className="font-mono text-[11px]">fetch_market_data.py</code> 并行抓取 + 按日缓存
          </p>
        </div>
        {step === "idle" && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={equityHoldings.length === 0}
            className="btn-gold !px-4 !py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            运行分析
          </button>
        )}
      </div>

      {loading && step === "running" && (
        <div className="flex items-center gap-2 py-4 text-[13px] text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-gold" aria-hidden />
          正在抓取市场数据（并行 + 缓存）并生成投研页（约 10–40 秒，美股期权链较慢）…
        </div>
      )}

      {error && <div className="text-[13px] text-rise">{error}</div>}

      {showResults && scores && wm && conc && (
        <div className="glass-panel animate-in p-5 text-slate-200 sm:p-6">
          {/* 页眉 */}
          <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-display text-xl font-bold text-white">{fundName}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {(productCode && productCode.trim()) || "—"} · <span className="num">{todayStr}</span> · Top{" "}
                <span className="num">{sortedForMatrix.length}</span> 持仓
              </p>
            </div>
            <div className="text-right sm:ml-auto">
              <div className={`num text-4xl font-semibold ${scoreTextClass(scores.overall)}`}>{scores.overall}</div>
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
              <div key={title} className="glass-card rounded-xl p-3">
                <div className="text-[11px] text-slate-500">{title}</div>
                <div className={`num text-2xl font-semibold ${scoreTextClass(val)}`}>{val}</div>
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
                <div className="glass-card h-full cursor-help rounded-xl p-2">
                  <div className="text-[11px] text-slate-500">{k}</div>
                  <div className="num text-lg font-semibold text-slate-100">{v}</div>
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
                    className="glass-card flex flex-col gap-1 rounded-xl px-3 py-2 sm:flex-row sm:items-center"
                  >
                    <div className="w-full shrink-0 text-sm text-slate-200 sm:w-44">
                      <span className="font-mono font-medium">{d.ticker}</span>
                      <span className="ml-2 truncate text-xs text-slate-500">{label}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-navy">
                        <div
                          className="h-full rounded-full bg-gradient-gold"
                          style={{ width: `${peBarWidth(pe)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:justify-end">
                      <span className="num text-xs text-slate-400">PE {pe != null ? pe.toFixed(1) : "—"}</span>
                      <span className={badge.cls}>{badge.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 集中度 */}
          <div className="mb-5">
            <h4 className="mb-2 text-sm font-medium text-slate-300">持仓集中度</h4>
            <div className="flex h-8 w-full overflow-hidden rounded-lg border border-white/[0.07] bg-navy">
              {sortedForMatrix.map((d, i) => {
                const pct = (d.weight ?? 0) * 100;
                const flexGrow = Math.max(d.weight ?? 0, 0.002);
                return (
                  <div
                    key={`bar-${d.ticker}-${i}`}
                    title={`${d.ticker} ${pct.toFixed(1)}%`}
                    className="min-w-[3px]"
                    style={{
                      flex: `${flexGrow} 1 0`,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Top4 合计 <span className="num">{(conc.top4Weight * 100).toFixed(1)}%</span> · Top10 合计{" "}
              <span className="num">{(conc.top10Weight * 100).toFixed(1)}%</span> · HHI{" "}
              <span className="num">{conc.hhi.toFixed(1)}</span> · 有效持仓数（1/Σw²）{" "}
              <span className="num">{conc.effectiveN.toFixed(2)}</span>
            </p>
          </div>

          {/* 风险标志 */}
          {analysis.riskFlags.length > 0 && (
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-medium text-slate-300">风险与信号标签</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.riskFlags.map((f, i) => (
                  <span key={i} className={flagClass(f.type)}>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI 解读 */}
          <div className="glass-card rounded-xl p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gold-light">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI 投研解读
            </h4>
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
            className="btn-ghost mt-4 !px-3.5 !py-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            重新分析
          </button>
        </div>
      )}

      {marketData.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-500 transition-colors hover:text-slate-300">
            查看个股原始数据
          </summary>
          <div className="atlas-table-wrap mt-2">
            <table className="atlas-table">
              <thead>
                <tr>
                  <th>股票</th>
                  <th>详情</th>
                  <th>权重</th>
                  <th>PE</th>
                  <th>PB</th>
                  <th>IV</th>
                  <th>PCR</th>
                  <th>股息%</th>
                  <th>缓存</th>
                  <th>数据源</th>
                  <th>质量</th>
                </tr>
              </thead>
              <tbody>
                {marketData.map((d, i) => (
                  <tr key={i} className={d.error ? "[&_td]:text-slate-600" : ""}>
                    <td className="font-mono">{d.ticker}</td>
                    <td>
                      {d.ticker && !d.error ? (
                        <Link
                          href={`/stock/${encodeURIComponent(String(d.ticker))}`}
                          className="text-xs text-info hover:text-info/80"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          打开
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{((d.weight ?? 0) * 100).toFixed(1)}%</td>
                    <td className="num">{d.pe_ttm != null ? Number(d.pe_ttm).toFixed(1) : "—"}</td>
                    <td className="num">{d.pb != null ? Number(d.pb).toFixed(2) : "—"}</td>
                    <td className="num">
                      {d.implied_volatility != null ? `${(Number(d.implied_volatility) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="num">{d.put_call_ratio != null ? Number(d.put_call_ratio).toFixed(2) : "—"}</td>
                    <td className="num">
                      {d.dividend_yield != null ? Number(d.dividend_yield).toFixed(2) : "—"}
                    </td>
                    <td>{d.cached ? "是" : "—"}</td>
                    <td className="text-[11px]">{d.data_source ?? "—"}</td>
                    <td>{d.data_quality ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="mt-3 text-[11px] text-slate-600">
        四维评分与集中度由服务端根据公开行情计算；AI 部分为解读辅助。仅供参考，不构成投资建议。
      </p>
    </div>
  );
}
