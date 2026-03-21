"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  holdings?: HoldingRow[];
  holdingsLoading?: boolean;
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
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selected, setSelected] = useState<MrfFund | null>(null);

  const handleRowClick = async (fund: MrfFund) => {
    if (selected?.fund_name === fund.fund_name) {
      setSelected(null);
      return;
    }
    // 用 sc_product_code 或 fund_name 查持仓（API 支持按两者查 Supabase mrf_holdings）
    const code = fund.sc_product_code?.trim() || fund.fund_name?.trim();
    if (!code) {
      setSelected({ ...fund, holdings: [], holdingsLoading: false });
      return;
    }
    setSelected({ ...fund, holdingsLoading: true });
    try {
      const res = await fetch(`/api/mrf/holdings/${encodeURIComponent(code)}`);
      const data = await res.json();
      setSelected({ ...fund, holdings: data.holdings ?? [], holdingsLoading: false });
    } catch {
      setSelected({ ...fund, holdings: [], holdingsLoading: false });
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
    const matched = funds.find((f) => f.fund_name === decoded || f.sc_product_code === decoded);
    console.log("[autoOpen] matched:", matched?.fund_name);
    if (matched) {
      autoOpenDone.current = true;
      handleRowClick(matched);
      // 等行内持仓面板挂载 + holdings fetch 后再滚动（面板紧跟选中行，不在表格末尾）
      setTimeout(() => {
        const rowKey = matched.sc_product_code || matched.fund_name;
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
        setFunds(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const brands = ["ALL", ...Array.from(new Set(funds.map((f) => f.brand)))];

  const filtered = funds.filter((f) => {
    const brandOk = selectedBrand === "ALL" || f.brand === selectedBrand;
    const typeOk =
      filter === "ALL"
        ? true
        : filter === "equity"
          ? f.equity_pct >= 80
          : filter === "balanced"
            ? f.equity_pct >= 30 && f.equity_pct < 80
            : f.equity_pct < 30;
    return brandOk && typeOk;
  });

  const brandData = Object.entries(
    funds.reduce((acc, f) => {
      acc[f.brand] = (acc[f.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const avgAlloc = filtered.length
    ? {
        equity: Math.round(filtered.reduce((s, f) => s + f.equity_pct, 0) / filtered.length),
        fixed: Math.round(filtered.reduce((s, f) => s + f.fixed_income_pct, 0) / filtered.length),
        cash: Math.round(filtered.reduce((s, f) => s + f.cash_pct, 0) / filtered.length),
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
                            {h.holding_name_std || h.holding_name_raw}
                          </Link>
                        ) : (
                          <span style={{ fontSize: 13, color: "#F9FAFB", fontWeight: 500 }}>
                            {h.holding_name_std || h.holding_name_raw}
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
                                {h.holding_name_std || h.holding_name_raw}
                                {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                  <span style={{ fontSize: 11, marginLeft: 6, color: "#60A5FA" }}>
                                    {ticker} ↗
                                  </span>
                                )}
                              </Link>
                            ) : (
                              <>
                                <span style={{ fontWeight: 500, color: "#F9FAFB" }}>
                                  {h.holding_name_std || h.holding_name_raw}
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
        {!sel.sc_product_code?.trim() && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#BA7517" }}>
            请先配置产品代码（Supabase mrf_funds.sc_product_code）
          </div>
        )}
        {sel.sc_product_code?.trim() && sel.holdings && sel.holdings.length === 0 && !sel.holdingsLoading && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
            暂无底层持仓数据（PDF 尚未解析此基金）
          </div>
        )}

        {sel.holdings && sel.holdings.length > 0 && (
          <HoldingsDeepAnalysis
            fundName={sel.fund_name}
            holdings={sel.holdings.slice(0, 10).map((h) => {
              const name = String(h.holding_name_std || h.holding_name_raw || "").trim();
              const rawTicker = getTickerFromHolding(name);
              const skip = new Set(["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"]);
              const ticker = rawTicker && !skip.has(rawTicker) ? rawTicker : undefined;
              const type = String(h.holding_type || "").toLowerCase().includes("equity") ? "equity" : "other";
              return {
                name,
                ticker,
                weight: Number(h.weight_pct) / 100,
                type,
              };
            })}
          />
        )}

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
            <Link href="/" className="text-info hover:underline">← Portfolio</Link>
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
          <Link href="/" className="text-info hover:underline">← Portfolio</Link>
          <h1 className="text-xl font-semibold text-white">MRF 基金池</h1>
          <span />
        </div>
      </header>

      <div style={s.page}>
        <div style={s.grid4}>
          {[
            { label: "MRF 基金池", value: `${funds.length} 只` },
            { label: "平均费率", value: `${(funds.reduce((s, f) => s + f.fee_rate, 0) / Math.max(funds.length, 1)).toFixed(2)}%` },
            { label: "筛选结果", value: `${filtered.length} 只` },
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
                data={filtered.slice(0, 8).map((f) => ({
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

        <div style={s.row}>
          <span style={{ fontSize: 11, color: "#6B7280", alignSelf: "center" }}>风险类型：</span>
          {([
            ["ALL", "全部"],
            ["equity", "进取型 ≥80%"],
            ["balanced", "均衡型 30-80%"],
            ["fixed", "稳健型 <30%"],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v as FilterType)} style={filter === v ? s.tabA : s.tab}>
              {l}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#6B7280", alignSelf: "center", marginLeft: 12 }}>品牌：</span>
          {brands.map((b) => (
            <button key={b} onClick={() => setSelectedBrand(b)} style={selectedBrand === b ? s.tabA : s.tab}>
              {b}
            </button>
          ))}
        </div>

        <div style={s.card}>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((f) => {
                const risk = getRiskLabel(f.equity_pct);
                const isSelected = selected?.fund_name === f.fund_name;
                return (
                  <Fragment key={f.fund_name}>
                    <div
                      id={`mrf-row-${f.sc_product_code || f.fund_name}`}
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
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>基金名称</th>
                <th style={s.th}>品牌</th>
                <th style={s.thr}>股票%</th>
                <th style={s.thr}>固定收益%</th>
                <th style={s.thr}>现金%</th>
                <th style={s.thr}>申购费率</th>
                <th style={s.thr}>风险类型</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const risk = getRiskLabel(f.equity_pct);
                const isSelected = selected?.fund_name === f.fund_name;
                return (
                  <Fragment key={f.fund_name}>
                    <tr
                      id={`mrf-row-${f.sc_product_code || f.fund_name}`}
                      onClick={() => handleRowClick(f)}
                      style={{ background: isSelected ? "rgba(24,95,165,0.12)" : "transparent" }}
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
                      <tr style={{ background: "rgba(24,95,165,0.06)" }}>
                        <td colSpan={8} style={{ padding: "0.75rem 12px", verticalAlign: "top", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                          {renderHoldingsPanelBelowRow()}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        <div style={{ marginTop: "1rem", fontSize: 11, color: "#4B5563", textAlign: "center" }}>
          数据来源：Supabase mrf_funds · 与 Streamlit 优化器同源
        </div>
      </div>
    </div>
  );
}
