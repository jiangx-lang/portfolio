"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  MRF_REGION_OPTIONS,
  MRF_THEME_OPTIONS,
  MRF_BOND_OPTIONS,
  fundMatchesHoldingTagFilters,
  type MrfBondOption,
  type MrfRegionOption,
  type MrfThemeOption,
} from "@/data/mrfHoldingTags";
import { formatMrfHoldingDisplayName } from "@/data/mrfHoldingNameUnified";
import MrfAISignalBox from "@/components/MrfAISignalBox";
import HoldingsDeepAnalysis from "@/components/HoldingsDeepAnalysis";
import { getTickerFromHolding, isClickable } from "@/lib/holdingTickerMap";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatFundNavDisplay, formatPerfNavDate, PerformanceCell } from "@/components/PerformanceCell";
import { perfSortValue, SortablePerfHeader, type PerfKey } from "@/components/SortablePerfHeader";
import { formatPerformanceLastUpdated } from "@/lib/formatPerformanceUpdated";
import type { FundPerformance } from "@/types/fund";

export interface HoldingRow {
  rank: number;
  holding_name_std: string;
  holding_name_raw: string | null;
  holding_type: string;
  weight_pct: number;
  as_of_date: string;
}

export interface MrfFund {
  fund_name: string;
  brand: string;
  equity_pct: number;
  fixed_income_pct: number;
  cash_pct: number;
  fee_rate: number;
  sc_product_code?: string | null;
  performance?: FundPerformance | null;
  holdings?: HoldingRow[];
  holdingsLoading?: boolean;
  /** 持仓接口返回的提示（如未配置 Supabase） */
  holdingsFetchMessage?: string;
}

/** Supabase 可能把 sc_product_code 序列化成 number，直接 .trim() 会抛错 */
function mrfProductCodeStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function mrfFundHoldingsCacheKey(f: MrfFund): string {
  return mrfProductCodeStr(f.sc_product_code) || f.fund_name?.trim() || "";
}

/** 品牌配色：香槟金 / 信息蓝 / 石板灰的高级暗色盘 */
const BRAND_COLORS: Record<string, string> = {
  Amundi: "#C9A84C",
  BEA: "#5B93F0",
  ValuePartners: "#E3C87A",
  JPM: "#2F66C4",
  Pictet: "#9A7E2F",
  BOC: "#94A3B8",
  Schroders: "#64748B",
};

const BRAND_COLOR_FALLBACK = "#64748B";

/** 资产配置堆叠柱：股票金 / 固收蓝 / 现金石板 */
const ALLOC_COLORS = {
  equity: "#C9A84C",
  fixed: "#5B93F0",
  cash: "#64748B",
} as const;

/** recharts 浮层：深色玻璃 + 金边（图表库仅支持 style 传入） */
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "#111A2E",
  border: "1px solid rgba(201, 168, 76, 0.35)",
  borderRadius: 12,
  fontSize: 12,
  color: "#F4F6FB",
  boxShadow: "0 10px 34px rgba(0, 0, 0, 0.45)",
};

const CHART_TICK_STYLE = { fontSize: 10, fill: "#66738C" };

type FilterType = "ALL" | "equity" | "balanced" | "fixed";

function getRiskLabel(equity: number): { label: string; badgeClass: string } {
  if (equity >= 80) return { label: "进取型", badgeClass: "badge badge-red" };
  if (equity >= 40) return { label: "均衡型", badgeClass: "badge badge-gold" };
  return { label: "稳健型", badgeClass: "badge badge-green" };
}

function feeTextClass(fee: number): string {
  if (fee >= 3) return "text-rise";
  if (fee >= 2) return "text-gold";
  return "text-fall";
}

function filterTabClass(active: boolean): string {
  return [
    "cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors",
    active
      ? "border-gold/40 bg-gold/10 text-gold-light"
      : "border-white/[0.07] text-slate-400 hover:border-gold/25 hover:text-slate-200",
  ].join(" ");
}

export default function MrfPageInner() {
  const { isMobile } = useIsMobile();
  const [funds, setFunds] = useState<MrfFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [selectedRegion, setSelectedRegion] = useState<MrfRegionOption>("全部");
  const [selectedTheme, setSelectedTheme] = useState<MrfThemeOption>("全部");
  const [selectedBond, setSelectedBond] = useState<MrfBondOption>("全部");
  const [selected, setSelected] = useState<MrfFund | null>(null);
  const [holdingsCache, setHoldingsCache] = useState<Record<string, HoldingRow[]>>({});
  const [holdingsPrefetchReady, setHoldingsPrefetchReady] = useState(false);
  const [performanceLastUpdated, setPerformanceLastUpdated] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PerfKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function handlePerfSort(key: PerfKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const handleRowClick = async (fund: MrfFund) => {
    console.log("[MRF] handleSelectFund called:", fund.fund_name);
    if (selected?.fund_name === fund.fund_name) {
      console.log("[MRF] same row clicked, collapsing:", fund.fund_name);
      setSelected(null);
      return;
    }
    // 用 sc_product_code 或 fund_name 查持仓（API 支持按两者查 Supabase mrf_holdings）
    const code = mrfProductCodeStr(fund.sc_product_code) || fund.fund_name?.trim() || "";
    console.log("[MRF] code:", code, "sc_product_code:", mrfProductCodeStr(fund.sc_product_code));
    if (!code) {
      console.warn("[MRF] empty code, set empty holdings:", fund.fund_name);
      setSelected({ ...fund, holdings: [], holdingsLoading: false, holdingsFetchMessage: undefined });
      return;
    }
    console.log("[MRF] setSelected loading=true:", fund.fund_name);
    setSelected({ ...fund, holdingsLoading: true, holdingsFetchMessage: undefined });
    try {
      const url = `/api/mrf/holdings/${encodeURIComponent(code)}`;
      console.log("[MRF] fetching:", url);
      const res = await fetch(url);
      const data = (await res.json().catch(() => ({}))) as {
        holdings?: HoldingRow[];
        message?: string;
      };
      console.log(
        "[MRF] response:",
        res.status,
        "holdings=",
        Array.isArray(data.holdings) ? data.holdings.length : "not-array",
        "message=",
        data.message
      );
      const msg = typeof data.message === "string" ? data.message : undefined;
      setSelected({
        ...fund,
        holdings: Array.isArray(data.holdings) ? data.holdings : [],
        holdingsLoading: false,
        holdingsFetchMessage: msg,
      });
    } catch (e) {
      console.error("[MRF] fetch failed:", e);
      setSelected({
        ...fund,
        holdings: [],
        holdingsLoading: false,
        holdingsFetchMessage: "FETCH_FAILED",
      });
    }
  };

  useEffect(() => {
    if (!selected) {
      console.log("[MRF] selected changed: null");
      return;
    }
    console.log(
      "[MRF] selected changed:",
      selected.fund_name,
      "loading=",
      !!selected.holdingsLoading,
      "holdings=",
      selected.holdings?.length ?? "undefined",
      "message=",
      selected.holdingsFetchMessage
    );
  }, [selected]);

  const searchParams = useSearchParams();
  const autoOpenDone = useRef(false);

  useEffect(() => {
    if (autoOpenDone.current || !funds || funds.length === 0) return;
    const fundParam = searchParams.get("fund");
    if (!fundParam) return;
    console.log("[autoOpen] funds:", funds?.length, "param:", searchParams.get("fund"));
    let decoded = fundParam;
    try {
      decoded = decodeURIComponent(fundParam);
    } catch {
      decoded = fundParam;
    }
    console.log("[autoOpen] decoded:", decoded);
    const matched = funds.find(
      (f) => f.fund_name === decoded || mrfProductCodeStr(f.sc_product_code) === decoded
    );
    console.log("[autoOpen] matched:", matched?.fund_name);
    if (matched) {
      autoOpenDone.current = true;
      handleRowClick(matched);
      // 等行内持仓面板挂载 + holdings fetch 后再滚动（面板紧跟选中行，不在表格末尾）
      setTimeout(() => {
        const rowKey = mrfProductCodeStr(matched.sc_product_code) || matched.fund_name;
        const rowId = `mrf-row-${rowKey}`;
        const panel = document.getElementById("mrf-holdings-panel");
        const rowEl = document.getElementById(rowId);
        if (panel) {
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (rowEl) {
          rowEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 1500);
    }
  }, [funds, searchParams]);

  useEffect(() => {
    fetch("/api/mrf/funds")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object" && Array.isArray(d.funds)) {
          setFunds(d.funds);
          setPerformanceLastUpdated(
            typeof d.performanceLastUpdated === "string" ? d.performanceLastUpdated : null
          );
        } else if (Array.isArray(d)) {
          setFunds(d);
          setPerformanceLastUpdated(null);
        } else {
          setFunds([]);
          setPerformanceLastUpdated(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setPerformanceLastUpdated(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!funds.length) {
      setHoldingsCache({});
      setHoldingsPrefetchReady(false);
      return;
    }
    let cancelled = false;
    setHoldingsPrefetchReady(false);
    (async () => {
      const results = await Promise.all(
        funds.map(async (f) => {
          const code = mrfFundHoldingsCacheKey(f);
          if (!code) return { key: "", holdings: [] as HoldingRow[] };
          try {
            const res = await fetch(`/api/mrf/holdings/${encodeURIComponent(code)}`);
            const data = (await res.json().catch(() => ({}))) as { holdings?: HoldingRow[] };
            return {
              key: code,
              holdings: Array.isArray(data.holdings) ? data.holdings : [],
            };
          } catch {
            return { key: code, holdings: [] as HoldingRow[] };
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, HoldingRow[]> = {};
      for (const { key, holdings } of results) {
        if (key) map[key] = holdings;
      }
      setHoldingsCache(map);
      setHoldingsPrefetchReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [funds]);

  const riskFiltered = useMemo(
    () =>
      funds.filter((f) => {
        if (filter === "ALL") return true;
        if (filter === "equity") return f.equity_pct >= 80;
        if (filter === "balanced") return f.equity_pct >= 30 && f.equity_pct < 80;
        return f.equity_pct < 30;
      }),
    [funds, filter]
  );

  const anyHoldingTagFilter =
    selectedRegion !== "全部" || selectedTheme !== "全部" || selectedBond !== "全部";

  const sortedDisplay = useMemo(() => {
    const list = [...riskFiltered];
    list.sort((a, b) => a.fund_name.localeCompare(b.fund_name, "zh-Hans-CN"));
    if (!anyHoldingTagFilter || !holdingsPrefetchReady) return list;
    const matching = list.filter((f) =>
      fundMatchesHoldingTagFilters(
        holdingsCache[mrfFundHoldingsCacheKey(f)],
        selectedRegion,
        selectedTheme,
        selectedBond
      )
    );
    const nonMatching = list.filter(
      (f) =>
        !fundMatchesHoldingTagFilters(
          holdingsCache[mrfFundHoldingsCacheKey(f)],
          selectedRegion,
          selectedTheme,
          selectedBond
        )
    );
    return [...matching, ...nonMatching];
  }, [
    riskFiltered,
    anyHoldingTagFilter,
    holdingsPrefetchReady,
    holdingsCache,
    selectedRegion,
    selectedTheme,
    selectedBond,
  ]);

  const displayFunds = useMemo(() => {
    if (!sortKey) return sortedDisplay;
    return [...sortedDisplay].sort((a, b) => {
      const va = perfSortValue(a.performance?.[sortKey]);
      const vb = perfSortValue(b.performance?.[sortKey]);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [sortedDisplay, sortKey, sortDir]);

  function rowTagOpacity(f: MrfFund) {
    if (!anyHoldingTagFilter || !holdingsPrefetchReady) return 1;
    return fundMatchesHoldingTagFilters(
      holdingsCache[mrfFundHoldingsCacheKey(f)],
      selectedRegion,
      selectedTheme,
      selectedBond
    )
      ? 1
      : 0.4;
  }

  const brandData = Object.entries(
    funds.reduce((acc, f) => {
      acc[f.brand] = (acc[f.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const avgAlloc = riskFiltered.length
    ? {
        equity: Math.round(
          riskFiltered.reduce((s, f) => s + f.equity_pct, 0) / riskFiltered.length
        ),
        fixed: Math.round(
          riskFiltered.reduce((s, f) => s + f.fixed_income_pct, 0) / riskFiltered.length
        ),
        cash: Math.round(
          riskFiltered.reduce((s, f) => s + f.cash_pct, 0) / riskFiltered.length
        ),
      }
    : { equity: 0, fixed: 0, cash: 0 };

  /** 持仓展开区：必须用当前 `selected`（含 fetch 后的 holdings），紧贴选中行渲染 */
  const renderHoldingsPanelBelowRow = () => {
    if (!selected) return null;
    const sel = selected;
    console.log(
      "[MRF] renderHoldingsPanel:",
      sel.fund_name,
      "loading=",
      !!sel.holdingsLoading,
      "holdings=",
      sel.holdings?.length ?? "undefined",
      "message=",
      sel.holdingsFetchMessage
    );
    const risk = getRiskLabel(sel.equity_pct);
    return (
      <div
        id="mrf-holdings-panel"
        className="rounded-xl border border-white/[0.07] border-l-2 bg-navy-elevated/70 p-4"
        style={{ borderLeftColor: BRAND_COLORS[sel.brand] ?? BRAND_COLOR_FALLBACK }}
      >
        <div className="mb-3 text-sm font-medium text-slate-100">{sel.fund_name}</div>
        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">配置</div>
            <div className="num text-[13px] text-slate-100">
              股票{sel.equity_pct}% / 债{sel.fixed_income_pct}% / 现金{sel.cash_pct}%
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">申购费率</div>
            <div className="num text-[13px] text-slate-100">{sel.fee_rate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">风险等级</div>
            <span className={risk.badgeClass}>{risk.label}</span>
          </div>
        </div>
        {sel.holdingsLoading && (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-48" />
            <p className="text-xs text-slate-500">正在加载持仓…</p>
          </div>
        )}
        {sel.holdings && sel.holdings.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              Top {sel.holdings.length} Holdings
            </div>
            {isMobile ? (
              <div>
                {sel.holdings.map((h, i) => {
                  const nameKey = (h.holding_name_std || h.holding_name_raw || "").trim();
                  const ticker = getTickerFromHolding(nameKey);
                  const canClick = Boolean(ticker && isClickable(nameKey));
                  const href = canClick && ticker ? `/stock/${encodeURIComponent(ticker)}` : undefined;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="num mr-1.5 text-[13px] text-slate-500">{h.rank ?? i + 1}.</span>
                        {href ? (
                          <Link
                            href={href}
                            className="text-[13px] font-medium text-info transition-colors hover:text-gold-light"
                          >
                            {formatMrfHoldingDisplayName(nameKey)}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-medium text-slate-100">
                            {formatMrfHoldingDisplayName(nameKey)}
                          </span>
                        )}
                        {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                          <span className="num ml-1 text-[10px] text-slate-500">{ticker}</span>
                        )}
                      </div>
                      <div className="ml-2 text-right">
                        <div className="num text-[13px] text-gold-light">{Number(h.weight_pct).toFixed(2)}%</div>
                        <div className="text-[10px] text-slate-500">{h.holding_type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">持仓名称</th>
                    <th className="px-2 py-1.5 text-left font-medium">类型</th>
                    <th className="px-2 py-1.5 text-right font-medium">权重%</th>
                    <th className="px-2 py-1.5 text-right font-medium">截至日期</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.holdings.map((h, i) =>
                    (() => {
                      const nameKey = (h.holding_name_std || h.holding_name_raw || "").trim();
                      const ticker = getTickerFromHolding(nameKey);
                      const canClick = Boolean(ticker && isClickable(nameKey));
                      const href = canClick && ticker ? `/stock/${encodeURIComponent(ticker)}` : undefined;
                      return (
                        <tr
                          key={i}
                          className="border-t border-white/5"
                          title={
                            canClick
                              ? `查看公开市场数据：${ticker}`
                              : ticker
                                ? `已识别：${ticker}（暂无标的详情）`
                                : undefined
                          }
                        >
                          <td className="num px-2 py-1.5 text-slate-500">{h.rank ?? i + 1}</td>
                          <td className="px-2 py-1.5">
                            {href ? (
                              <Link
                                href={href}
                                className="font-medium text-info transition-colors hover:text-gold-light"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {formatMrfHoldingDisplayName(nameKey)}
                                {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                  <span className="num ml-1.5 text-[11px] text-info">
                                    {ticker} ↗
                                  </span>
                                )}
                              </Link>
                            ) : (
                              <>
                                <span className="font-medium text-slate-100">
                                  {formatMrfHoldingDisplayName(nameKey)}
                                </span>
                                {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                  <span className="num ml-1.5 text-[11px] text-slate-500">{ticker}</span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-slate-400">{h.holding_type}</td>
                          <td className="num px-2 py-1.5 text-right text-gold-light">
                            {Number(h.weight_pct).toFixed(2)}%
                          </td>
                          <td className="num px-2 py-1.5 text-right text-slate-500">{h.as_of_date}</td>
                        </tr>
                      );
                    })()
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
        {!mrfProductCodeStr(sel.sc_product_code) && (
          <div className="mt-3 text-xs text-gold-light">
            请先配置产品代码（Supabase mrf_funds.sc_product_code）
          </div>
        )}
        {sel.holdingsFetchMessage === "SUPABASE_NOT_CONFIGURED" && (
          <div className="mt-3 text-xs leading-relaxed text-rise">
            当前运行环境未配置 Supabase（需设置 <code className="rounded bg-white/5 px-1">SUPABASE_URL</code>、<code className="rounded bg-white/5 px-1">SUPABASE_KEY</code>
            ）。列表可能来自本地 Mock，但 MRF 持仓只从数据库读取，故显示为空。请在 Vercel / 服务器环境变量中配置后重新部署。
          </div>
        )}
        {sel.holdingsFetchMessage === "NO_MRF_HOLDINGS_ROWS" && mrfProductCodeStr(sel.sc_product_code) && (
          <div className="mt-3 text-xs text-slate-500">
            数据库中未找到该代码/名称对应的持仓行，请核对 mrf_holdings.sc_product_code 与 mrf_funds 是否一致。
          </div>
        )}
        {sel.holdingsFetchMessage === "FETCH_FAILED" && (
          <div className="mt-3 text-xs text-rise">
            加载持仓失败（网络或接口异常），请打开开发者工具查看 /api/mrf/holdings/ 请求。
          </div>
        )}
        {mrfProductCodeStr(sel.sc_product_code) &&
          sel.holdings &&
          sel.holdings.length === 0 &&
          !sel.holdingsLoading &&
          !sel.holdingsFetchMessage && (
          <div className="mt-3 text-xs text-slate-500">
            暂无底层持仓数据（PDF 尚未解析此基金）
          </div>
        )}

        {sel.holdings && sel.holdings.length > 0 && (() => {
          const skipTickers = new Set(["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"]);
          const top10 = sel.holdings.slice(0, 10);
          const holdingsPayload = top10.map((h) => {
            const name = String(h.holding_name_std || h.holding_name_raw || "").trim();
            const rawTicker = getTickerFromHolding(name);
            const ticker = rawTicker && !skipTickers.has(rawTicker) ? rawTicker : undefined;
            const type = String(h.holding_type || "").toLowerCase().includes("equity") ? "equity" : "other";
            return {
              name,
              ticker,
              weight: Number(h.weight_pct) / 100,
              type,
            };
          });
          // 与 HoldingsDeepAnalysis 一致：仅 equity 且可映射 yfinance 的标的
          const validEquityCount = holdingsPayload.filter(
            (h) => h.type === "equity" && h.ticker && h.ticker.length > 0
          ).length;
          return (
            <>
              {validEquityCount >= 3 ? (
                <HoldingsDeepAnalysis
                  fundName={sel.fund_name}
                  productCode={mrfProductCodeStr(sel.sc_product_code) || undefined}
                  holdings={holdingsPayload}
                />
              ) : (
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-navy/50 p-4">
                  <p className="mb-1.5 text-sm font-medium text-slate-300">
                    持仓说明
                  </p>
                  <p className="max-w-[520px] text-xs leading-relaxed text-slate-500">
                    本基金以固定收益类资产为主要持仓，可映射股票代码的持仓不足 3 只，股票型「持仓深度分析」不适用。可参考上方资产配置中的股票/债券/现金比例与基金招募说明书中的久期、信用风险等披露。
                  </p>
                </div>
              )}
            </>
          );
        })()}

        <MrfAISignalBox
          fund={{
            fund_name: sel.fund_name,
            brand: sel.brand,
            equity_pct: sel.equity_pct,
            fixed_income_pct: sel.fixed_income_pct,
            cash_pct: sel.cash_pct,
            fee_rate: sel.fee_rate,
            holdings: sel.holdings,
          }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-24">
          <header className="mb-8">
            <span className="eyebrow">MUTUAL RECOGNITION FUNDS</span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">MRF 互认基金</h1>
          </header>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-20" />
            ))}
          </div>
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-24">
        <Link
          href="/portfolio"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-gold"
        >
          <ArrowLeft size={14} />
          返回投资组合
        </Link>

        <header className="mb-8 animate-in">
          <span className="eyebrow">MUTUAL RECOGNITION FUNDS</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">MRF 互认基金</h1>
          <p className="text-sm text-slate-400 mt-2">
            中港互认基金池：品牌分布、资产配置与底层持仓透视
          </p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "MRF 基金池", value: `${funds.length} 只`, valueClass: "text-slate-100" },
            {
              label: "平均费率",
              value: `${(funds.reduce((s, f) => s + f.fee_rate, 0) / Math.max(funds.length, 1)).toFixed(2)}%`,
              valueClass: "text-slate-100",
            },
            { label: "筛选结果", value: `${riskFiltered.length} 只`, valueClass: "text-gold-light" },
            {
              label: "平均股票比",
              value: `${avgAlloc.equity}%`,
              valueClass:
                avgAlloc.equity >= 70 ? "text-rise" : avgAlloc.equity >= 40 ? "text-gold" : "text-fall",
            },
          ].map((m) => (
            <div key={m.label} className="glass-card p-4">
              <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">{m.label}</div>
              <div className={`num text-xl font-medium ${m.valueClass}`}>{m.value}</div>
            </div>
          ))}
        </div>

        <div className={`mb-6 grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <div className="glass-card p-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
              按品牌分布
            </div>
            <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {brandData.map((b) => (
                <span key={b.name} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: BRAND_COLORS[b.name] ?? BRAND_COLOR_FALLBACK }}
                  />
                  {b.name} <span className="num">{b.value}只</span>
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={brandData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {brandData.map((b) => (
                    <Cell key={b.name} fill={BRAND_COLORS[b.name] ?? BRAND_COLOR_FALLBACK} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
              资产配置对比（当前筛选）
            </div>
            <div className="mb-2 flex gap-6">
              {[
                { label: "股票", value: avgAlloc.equity, textClass: "text-gold" },
                { label: "固定收益", value: avgAlloc.fixed, textClass: "text-info" },
                { label: "现金", value: avgAlloc.cash, textClass: "text-slate-400" },
              ].map((a) => (
                <div key={a.label} className="text-center">
                  <div className={`num text-lg font-medium ${a.textClass}`}>{a.value}%</div>
                  <div className="text-[10px] text-slate-500">{a.label}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={riskFiltered.slice(0, 8).map((f) => ({
                  name: f.fund_name.slice(0, 8),
                  股票: f.equity_pct,
                  固定收益: f.fixed_income_pct,
                  现金: f.cash_pct,
                }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 194, 0.08)" />
                <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
                <YAxis tick={CHART_TICK_STYLE} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="股票" stackId="a" fill={ALLOC_COLORS.equity} />
                <Bar dataKey="固定收益" stackId="a" fill={ALLOC_COLORS.fixed} />
                <Bar dataKey="现金" stackId="a" fill={ALLOC_COLORS.cash} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">风险类型：</span>
            {([
              ["ALL", "全部"],
              ["equity", "进取型 ≥80%"],
              ["balanced", "均衡型 30-80%"],
              ["fixed", "稳健型 <30%"],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v as FilterType)}
                className={filterTabClass(filter === v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">地域：</span>
            {MRF_REGION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedRegion(opt)}
                className={filterTabClass(selectedRegion === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">主题：</span>
            {MRF_THEME_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedTheme(opt)}
                className={filterTabClass(selectedTheme === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">债券：</span>
            {MRF_BOND_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedBond(opt)}
                className={filterTabClass(selectedBond === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            标签按底层持仓匹配：已选地域/主题/债券须同时满足（各维度任一只持仓命中即可）；完全匹配排前、不透明；否则置底并半透明显示。预取完成前不按标签排序。
          </p>
        </div>

        <div>
          {isMobile ? (
            <div className="flex flex-col gap-3">
              {displayFunds.map((f) => {
                const risk = getRiskLabel(f.equity_pct);
                const isSelected = selected?.fund_name === f.fund_name;
                const op = rowTagOpacity(f);
                return (
                  <Fragment key={f.fund_name}>
                    <div
                      id={`mrf-row-${mrfProductCodeStr(f.sc_product_code) || f.fund_name}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(f)}
                      onKeyDown={(e) => e.key === "Enter" && handleRowClick(f)}
                      className={`glass-card p-4 transition-opacity ${
                        isSelected ? "border-gold/40" : ""
                      }`}
                      style={{ opacity: op }}
                    >
                      <div className="mb-2 text-sm font-medium text-slate-100">
                        {f.fund_name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className={`num text-[11px] ${feeTextClass(f.fee_rate)}`}>
                          手续费 {f.fee_rate.toFixed(1)}%
                        </span>
                        <span className="num text-[11px] text-slate-500">
                          股票 {f.equity_pct}% · 固收 {f.fixed_income_pct}%
                        </span>
                        <span className={risk.badgeClass}>{risk.label}</span>
                        <span className="num text-[11px] text-slate-400">
                          NAV {formatFundNavDisplay(f.performance?.nav)} ·{" "}
                          {formatPerfNavDate(f.performance?.nav_date) ?? "—"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-white/[0.06] pt-2.5">
                        {(
                          [
                            ["日涨跌", f.performance?.daily_return],
                            ["1周", f.performance?.weekly_return],
                            ["1月", f.performance?.monthly_1],
                            ["3月", f.performance?.monthly_3],
                            ["6月", f.performance?.monthly_6],
                            ["1年", f.performance?.yearly_1],
                          ] as const
                        ).map(([label, v]) => (
                          <div key={label} className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">{label}</span>
                            <PerformanceCell value={v} />
                          </div>
                        ))}
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2.5 text-right"
                      >
                        <a
                          href={`/mrf?fund=${encodeURIComponent(f.fund_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] text-info transition-colors hover:bg-info/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          深度分析 →
                        </a>
                      </div>
                    </div>
                    {isSelected && renderHoldingsPanelBelowRow()}
                  </Fragment>
                );
              })}
            </div>
          ) : (
          <div className="atlas-table-wrap">
          <table className="atlas-table min-w-[1320px]">
            <thead>
              <tr>
                <th>基金名称</th>
                <th><span className="block text-right">股票%</span></th>
                <th><span className="block text-right">固定收益%</span></th>
                <th><span className="block text-right">现金%</span></th>
                <th><span className="block text-right">申购费率</span></th>
                <th><span className="block text-right">风险类型</span></th>
                <th><span className="block text-right">NAV</span></th>
                <th><span className="block text-right">NAV更新日期</span></th>
                <SortablePerfHeader
                  label="日涨跌"
                  perfKey="daily_return"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  borderLeft
                  minWidth={66}
                />
                <SortablePerfHeader
                  label="1周"
                  perfKey="weekly_return"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                />
                <SortablePerfHeader
                  label="1月"
                  perfKey="monthly_1"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                />
                <SortablePerfHeader
                  label="3月"
                  perfKey="monthly_3"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                />
                <SortablePerfHeader
                  label="6月"
                  perfKey="monthly_6"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                />
                <SortablePerfHeader
                  label="1年"
                  perfKey="yearly_1"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                />
                <th><span className="block text-right">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {displayFunds.map((f) => {
                const risk = getRiskLabel(f.equity_pct);
                const isSelected = selected?.fund_name === f.fund_name;
                const op = rowTagOpacity(f);
                const perf = f.performance;
                return (
                  <Fragment key={f.fund_name}>
                    <tr
                      id={`mrf-row-${mrfProductCodeStr(f.sc_product_code) || f.fund_name}`}
                      onClick={() => handleRowClick(f)}
                      className={`cursor-pointer transition-opacity ${
                        isSelected ? "bg-gold/[0.06]" : ""
                      }`}
                      style={{ opacity: op }}
                    >
                      <td>
                        <div className="text-[13px] font-medium text-slate-100">{f.fund_name}</div>
                      </td>
                      <td className="num text-right">{f.equity_pct}%</td>
                      <td className="num text-right">{f.fixed_income_pct}%</td>
                      <td className="num text-right">{f.cash_pct}%</td>
                      <td className={`num text-right ${feeTextClass(f.fee_rate)}`}>
                        {f.fee_rate.toFixed(1)}%
                      </td>
                      <td className="text-right">
                        <span className={risk.badgeClass}>{risk.label}</span>
                      </td>
                      <td className="num text-right text-slate-200">
                        {formatFundNavDisplay(perf?.nav)}
                      </td>
                      <td className="num text-right text-slate-400">
                        {formatPerfNavDate(perf?.nav_date) ?? "—"}
                      </td>
                      <td className="border-l border-white/[0.07]">
                        <PerformanceCell value={perf?.daily_return} />
                      </td>
                      <td>
                        <PerformanceCell value={perf?.weekly_return} />
                      </td>
                      <td>
                        <PerformanceCell value={perf?.monthly_1} />
                      </td>
                      <td>
                        <PerformanceCell value={perf?.monthly_3} />
                      </td>
                      <td>
                        <PerformanceCell value={perf?.monthly_6} />
                      </td>
                      <td>
                        <PerformanceCell value={perf?.yearly_1} />
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/mrf?fund=${encodeURIComponent(f.fund_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] text-info transition-colors hover:bg-info/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          深度分析 →
                        </a>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr className="bg-gold/[0.03]">
                        <td colSpan={15}>
                          {renderHoldingsPanelBelowRow()}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
        </div>

        <hr className="hairline-gold mt-8" />
        <div className="mt-4 text-center text-[11px] text-slate-500">
          数据来源：Supabase mrf_funds · 与 Streamlit 优化器同源
        </div>
        {performanceLastUpdated ? (
          <p className="num mt-2 text-right text-xs text-slate-500">
            绩效数据更新时间：{formatPerformanceLastUpdated(performanceLastUpdated)} · 来源：基金公司 NAV
          </p>
        ) : null}
      </div>
    </div>
  );
}
