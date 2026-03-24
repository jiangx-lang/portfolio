"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { PerformanceCell } from "@/components/PerformanceCell";
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

const BRAND_COLORS: Record<string, string> = {
  Amundi: "#185FA5",
  BEA: "#1D9E75",
  ValuePartners: "#534AB7",
  JPM: "#BA7517",
  Pictet: "#D85A30",
  BOC: "#639922",
  Schroders: "#888780",
};

type FilterType = "ALL" | "equity" | "balanced" | "fixed";

function getRiskLabel(equity: number): { label: string; color: string } {
  if (equity >= 80) return { label: "进取型", color: "#D85A30" };
  if (equity >= 40) return { label: "均衡型", color: "#BA7517" };
  return { label: "稳健型", color: "#1D9E75" };
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
    if (selected?.fund_name === fund.fund_name) {
      setSelected(null);
      return;
    }
    // 用 sc_product_code 或 fund_name 查持仓（API 支持按两者查 Supabase mrf_holdings）
    const code = mrfProductCodeStr(fund.sc_product_code) || fund.fund_name?.trim() || "";
    if (!code) {
      setSelected({ ...fund, holdings: [], holdingsLoading: false, holdingsFetchMessage: undefined });
      return;
    }
    setSelected({ ...fund, holdingsLoading: true, holdingsFetchMessage: undefined });
    try {
      const res = await fetch(`/api/mrf/holdings/${encodeURIComponent(code)}`);
      const data = (await res.json().catch(() => ({}))) as {
        holdings?: HoldingRow[];
        message?: string;
      };
      const msg = typeof data.message === "string" ? data.message : undefined;
      setSelected({
        ...fund,
        holdings: Array.isArray(data.holdings) ? data.holdings : [],
        holdingsLoading: false,
        holdingsFetchMessage: msg,
      });
    } catch {
      setSelected({
        ...fund,
        holdings: [],
        holdingsLoading: false,
        holdingsFetchMessage: "FETCH_FAILED",
      });
    }
  };

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
    return (
      <div
        id="mrf-holdings-panel"
        style={{
          marginTop: 0,
          padding: "1rem",
          background: "#1F2937",
          borderRadius: 8,
          borderLeft: `2px solid ${BRAND_COLORS[sel.brand] ?? "#888"}`,
          opacity: 1,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: "#F9FAFB", marginBottom: 8 }}>{sel.fund_name}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
            gap: 8,
          }}
        >
          {[
            ["配置", `股票${sel.equity_pct}% / 债${sel.fixed_income_pct}% / 现金${sel.cash_pct}%`],
            ["申购费率", `${sel.fee_rate.toFixed(1)}%`],
            ["风险等级", getRiskLabel(sel.equity_pct).label],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 13, color: "#F9FAFB" }}>{v}</div>
            </div>
          ))}
        </div>
        {sel.holdingsLoading && (
          <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 8 }}>Loading holdings...</div>
        )}
        {sel.holdings && sel.holdings.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
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
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, marginRight: 6, color: "#6B7280" }}>{h.rank ?? i + 1}.</span>
                        {href ? (
                          <Link
                            href={href}
                            style={{
                              fontSize: 13,
                              color: "#60A5FA",
                              fontWeight: 500,
                              textDecoration: "none",
                            }}
                          >
                            {formatMrfHoldingDisplayName(nameKey)}
                          </Link>
                        ) : (
                          <span style={{ fontSize: 13, color: "#F9FAFB", fontWeight: 500 }}>
                            {formatMrfHoldingDisplayName(nameKey)}
                          </span>
                        )}
                        {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                          <span style={{ fontSize: 10, color: "#6B7280", marginLeft: 4 }}>{ticker}</span>
                        )}
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 8 }}>
                        <div style={{ fontSize: 13, color: "#1D9E75" }}>{Number(h.weight_pct).toFixed(2)}%</div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>{h.holding_type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#6B7280", fontWeight: 400 }}>#</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#6B7280", fontWeight: 400 }}>持仓名称</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", color: "#6B7280", fontWeight: 400 }}>类型</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "#6B7280", fontWeight: 400 }}>权重%</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", color: "#6B7280", fontWeight: 400 }}>截至日期</th>
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
                          style={{
                            borderTop: "0.5px solid rgba(255,255,255,0.05)",
                          }}
                          title={
                            canClick
                              ? `查看公开市场数据：${ticker}`
                              : ticker
                                ? `已识别：${ticker}（暂无标的详情）`
                                : undefined
                          }
                        >
                          <td style={{ padding: "5px 8px", color: "#6B7280" }}>{h.rank ?? i + 1}</td>
                          <td style={{ padding: "5px 8px" }}>
                            {href ? (
                              <Link
                                href={href}
                                style={{ fontWeight: 500, color: "#60A5FA", textDecoration: "none" }}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {formatMrfHoldingDisplayName(nameKey)}
                                {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                  <span style={{ fontSize: 11, marginLeft: 6, color: "#60A5FA" }}>
                                    {ticker} ↗
                                  </span>
                                )}
                              </Link>
                            ) : (
                              <>
                                <span style={{ fontWeight: 500, color: "#F9FAFB" }}>
                                  {formatMrfHoldingDisplayName(nameKey)}
                                </span>
                                {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                  <span style={{ fontSize: 11, marginLeft: 6, color: "#4B5563" }}>{ticker}</span>
                                )}
                              </>
                            )}
                          </td>
                          <td style={{ padding: "5px 8px", color: "#9CA3AF" }}>{h.holding_type}</td>
                          <td style={{ padding: "5px 8px", color: "#1D9E75", textAlign: "right" }}>
                            {Number(h.weight_pct).toFixed(2)}%
                          </td>
                          <td style={{ padding: "5px 8px", color: "#6B7280", textAlign: "right" }}>{h.as_of_date}</td>
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
          <div style={{ marginTop: 8, fontSize: 12, color: "#BA7517" }}>
            请先配置产品代码（Supabase mrf_funds.sc_product_code）
          </div>
        )}
        {sel.holdingsFetchMessage === "SUPABASE_NOT_CONFIGURED" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#F87171", lineHeight: 1.5 }}>
            当前运行环境未配置 Supabase（需设置 <code>SUPABASE_URL</code>、<code>SUPABASE_KEY</code>
            ）。列表可能来自本地 Mock，但 MRF 持仓只从数据库读取，故显示为空。请在 Vercel / 服务器环境变量中配置后重新部署。
          </div>
        )}
        {sel.holdingsFetchMessage === "NO_MRF_HOLDINGS_ROWS" && mrfProductCodeStr(sel.sc_product_code) && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
            数据库中未找到该代码/名称对应的持仓行，请核对 mrf_holdings.sc_product_code 与 mrf_funds 是否一致。
          </div>
        )}
        {sel.holdingsFetchMessage === "FETCH_FAILED" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#F87171" }}>
            加载持仓失败（网络或接口异常），请打开开发者工具查看 /api/mrf/holdings/ 请求。
          </div>
        )}
        {mrfProductCodeStr(sel.sc_product_code) &&
          sel.holdings &&
          sel.holdings.length === 0 &&
          !sel.holdingsLoading &&
          !sel.holdingsFetchMessage && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
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
                <div
                  className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-4"
                  style={{ marginTop: 20 }}
                >
                  <p className="text-sm font-medium text-slate-300" style={{ margin: "0 0 6px" }}>
                    持仓说明
                  </p>
                  <p className="text-xs text-slate-500" style={{ margin: 0, lineHeight: 1.65, maxWidth: 520 }}>
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

  const s: Record<string, React.CSSProperties> = {
    page: {
      padding: isMobile ? "1rem" : "1.5rem",
      paddingBottom: isMobile ? "5rem" : "1.5rem",
      fontFamily: "var(--font-sans, Inter, sans-serif)",
      color: "#F9FAFB",
      minHeight: "100vh",
    },
    grid4: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))",
      gap: 10,
      marginBottom: "1.25rem",
    },
    metric: { background: "#1F2937", borderRadius: 8, padding: "0.75rem 1rem" },
    mlabel: { fontSize: 10, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 },
    mval: { fontSize: 20, fontWeight: 500 },
    card: { background: "#111827", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "1rem 1.25rem" },
    stitle: { fontSize: 11, fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 10 },
    row: { display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" as const },
    tab: { padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "0.5px solid transparent", color: "#9CA3AF", background: "transparent" },
    tabA: { padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "0.5px solid #185FA5", color: "#60A5FA", background: "#185FA522" },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
    th: { padding: "8px 12px", textAlign: "left" as const, fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1F2937" },
    thr: { padding: "8px 12px", textAlign: "right" as const, fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1F2937" },
    td: { padding: "10px 12px", color: "#F9FAFB", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" },
    tdr: { padding: "10px 12px", color: "#F9FAFB", borderBottom: "0.5px solid rgba(255,255,255,0.05)", textAlign: "right" as const, fontVariantNumeric: "tabular-nums", cursor: "pointer" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link href="/portfolio" className="text-info hover:underline">← Portfolio</Link>
            <h1 className="text-xl font-semibold text-white">MRF 基金池</h1>
            <span />
          </div>
        </header>
        <div style={{ ...s.page, textAlign: "center", paddingTop: "4rem", color: "#9CA3AF" }}>Loading MRF funds...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/portfolio" className="text-info hover:underline">← Portfolio</Link>
          <h1 className="text-xl font-semibold text-white">MRF 基金池</h1>
          <span />
        </div>
      </header>

      <div style={s.page}>
        <div style={s.grid4}>
          {[
            { label: "MRF 基金池", value: `${funds.length} 只` },
            { label: "平均费率", value: `${(funds.reduce((s, f) => s + f.fee_rate, 0) / Math.max(funds.length, 1)).toFixed(2)}%` },
            { label: "筛选结果", value: `${riskFiltered.length} 只` },
            { label: "平均股票比", value: `${avgAlloc.equity}%`, color: avgAlloc.equity >= 70 ? "#D85A30" : avgAlloc.equity >= 40 ? "#BA7517" : "#1D9E75" },
          ].map((m) => (
            <div key={m.label} style={s.metric}>
              <div style={s.mlabel}>{m.label}</div>
              <div style={{ ...s.mval, color: m.color ?? "#F9FAFB" }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 12,
            marginBottom: "1.25rem",
          }}
        >
          <div style={s.card}>
            <div style={s.stitle}>按品牌分布</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {brandData.map((b) => (
                <span key={b.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: BRAND_COLORS[b.name] ?? "#888" }} />
                  {b.name} {b.value}只
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={brandData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {brandData.map((b) => (
                    <Cell key={b.name} fill={BRAND_COLORS[b.name] ?? "#888"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1F2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.stitle}>资产配置对比（当前筛选）</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              {[
                ["股票", avgAlloc.equity, "#185FA5"],
                ["固定收益", avgAlloc.fixed, "#1D9E75"],
                ["现金", avgAlloc.cash, "#BA7517"],
              ].map(([l, v, c]) => (
                <div key={String(l)} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 500, color: c as string }}>{v}%</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{l}</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 9, fill: "#6B7280" }} />
                <Tooltip contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="股票" stackId="a" fill="#185FA5" />
                <Bar dataKey="固定收益" stackId="a" fill="#1D9E75" />
                <Bar dataKey="现金" stackId="a" fill="#BA7517" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...s.row, flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6B7280", alignSelf: "center" }}>风险类型：</span>
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
                style={filter === v ? s.tabA : s.tab}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>地域：</span>
            {MRF_REGION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedRegion(opt)}
                style={selectedRegion === opt ? s.tabA : s.tab}
              >
                {opt}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>主题：</span>
            {MRF_THEME_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedTheme(opt)}
                style={selectedTheme === opt ? s.tabA : s.tab}
              >
                {opt}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>债券：</span>
            {MRF_BOND_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedBond(opt)}
                style={selectedBond === opt ? s.tabA : s.tab}
              >
                {opt}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "#4B5563", margin: 0 }}>
            标签按底层持仓匹配：已选地域/主题/债券须同时满足（各维度任一只持仓命中即可）；完全匹配排前、不透明；否则置底并半透明显示。预取完成前不按标签排序。
          </p>
        </div>

        <div style={s.card}>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      style={{
                        background: "#111827",
                        border: isSelected ? "1px solid rgba(24,95,165,0.5)" : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        cursor: "pointer",
                        opacity: op,
                        transition: "opacity 0.2s ease",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#F9FAFB" }}>
                        {f.fund_name}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: (BRAND_COLORS[f.brand] ?? "#888") + "22",
                            color: BRAND_COLORS[f.brand] ?? "#9CA3AF",
                          }}
                        >
                          {f.brand}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: f.fee_rate >= 3 ? "#D85A30" : f.fee_rate >= 2 ? "#BA7517" : "#1D9E75",
                          }}
                        >
                          手续费 {f.fee_rate.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>
                          股票 {f.equity_pct}% · 固收 {f.fixed_income_pct}%
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: risk.color + "22",
                            color: risk.color,
                          }}
                        >
                          {risk.label}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px 10px",
                          alignItems: "center",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: 8,
                        }}
                      >
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
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 10, color: "#6B7280" }}>{label}</span>
                            <PerformanceCell value={v} />
                          </div>
                        ))}
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: "6px", textAlign: "right" }}
                      >
                        <a
                          href={`/mrf?fund=${encodeURIComponent(f.fund_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            background: "#0f2744",
                            color: "#60a5fa",
                            border: "1px solid #3b82f6",
                            borderRadius: "5px",
                            fontSize: "11px",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
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
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1280px]" style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>基金名称</th>
                <th style={s.th}>品牌</th>
                <th style={s.thr}>股票%</th>
                <th style={s.thr}>固定收益%</th>
                <th style={s.thr}>现金%</th>
                <th style={s.thr}>申购费率</th>
                <th style={s.thr}>风险类型</th>
                <SortablePerfHeader
                  label="日涨跌"
                  perfKey="daily_return"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  borderLeft
                  minWidth={66}
                  style={s.thr}
                />
                <SortablePerfHeader
                  label="1周"
                  perfKey="weekly_return"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                  style={s.thr}
                />
                <SortablePerfHeader
                  label="1月"
                  perfKey="monthly_1"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                  style={s.thr}
                />
                <SortablePerfHeader
                  label="3月"
                  perfKey="monthly_3"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                  style={s.thr}
                />
                <SortablePerfHeader
                  label="6月"
                  perfKey="monthly_6"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                  style={s.thr}
                />
                <SortablePerfHeader
                  label="1年"
                  perfKey="yearly_1"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handlePerfSort}
                  minWidth={58}
                  style={s.thr}
                />
                <th></th>
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
                      style={{
                        background: isSelected ? "rgba(24,95,165,0.12)" : "transparent",
                        opacity: op,
                        transition: "opacity 0.2s ease",
                      }}
                    >
                      <td style={s.td}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{f.fund_name}</div>
                      </td>
                      <td style={s.td}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            background: (BRAND_COLORS[f.brand] ?? "#888") + "22",
                            color: BRAND_COLORS[f.brand] ?? "#9CA3AF",
                          }}
                        >
                          {f.brand}
                        </span>
                      </td>
                      <td style={s.tdr}>{f.equity_pct}%</td>
                      <td style={s.tdr}>{f.fixed_income_pct}%</td>
                      <td style={s.tdr}>{f.cash_pct}%</td>
                      <td
                        style={{
                          ...s.tdr,
                          color: f.fee_rate >= 3 ? "#D85A30" : f.fee_rate >= 2 ? "#BA7517" : "#1D9E75",
                        }}
                      >
                        {f.fee_rate.toFixed(1)}%
                      </td>
                      <td style={s.tdr}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            background: risk.color + "22",
                            color: risk.color,
                          }}
                        >
                          {risk.label}
                        </span>
                      </td>
                      <td style={{ ...s.tdr, minWidth: 66 }} className="border-l border-gray-700 px-3 py-2">
                        <PerformanceCell value={perf?.daily_return} />
                      </td>
                      <td style={{ ...s.tdr, minWidth: 58 }} className="px-3 py-2">
                        <PerformanceCell value={perf?.weekly_return} />
                      </td>
                      <td style={{ ...s.tdr, minWidth: 58 }} className="px-3 py-2">
                        <PerformanceCell value={perf?.monthly_1} />
                      </td>
                      <td style={{ ...s.tdr, minWidth: 58 }} className="px-3 py-2">
                        <PerformanceCell value={perf?.monthly_3} />
                      </td>
                      <td style={{ ...s.tdr, minWidth: 58 }} className="px-3 py-2">
                        <PerformanceCell value={perf?.monthly_6} />
                      </td>
                      <td style={{ ...s.tdr, minWidth: 58 }} className="px-3 py-2">
                        <PerformanceCell value={perf?.yearly_1} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/mrf?fund=${encodeURIComponent(f.fund_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            background: "#0f2744",
                            color: "#60a5fa",
                            border: "1px solid #3b82f6",
                            borderRadius: "5px",
                            fontSize: "11px",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          深度分析 →
                        </a>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr style={{ background: "rgba(24,95,165,0.06)", opacity: 1 }}>
                        <td colSpan={14} style={{ padding: "0.75rem 12px", verticalAlign: "top", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
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

        <div style={{ marginTop: "1rem", fontSize: 11, color: "#4B5563", textAlign: "center" }}>
          数据来源：Supabase mrf_funds · 与 Streamlit 优化器同源
        </div>
        {performanceLastUpdated ? (
          <p className="mt-2 text-right text-xs text-gray-600">
            绩效数据更新时间：{formatPerformanceLastUpdated(performanceLastUpdated)} · 来源：基金公司 NAV
          </p>
        ) : null}
      </div>
    </div>
  );
}
