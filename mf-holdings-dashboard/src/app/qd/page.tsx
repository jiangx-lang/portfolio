"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QdAISignalBox } from "@/components/QdAISignalBox";
import HoldingsDeepAnalysis from "@/components/HoldingsDeepAnalysis";
import { NavChart } from "@/components/NavChart";
import { getTickerFromHolding, isClickable } from "@/lib/holdingTickerMap";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  QD_BOND_SPECTRUM_GROUPS,
  QD_BOND_SPECTRUM_OPTIONS,
  fundMatchesQdFundFilters,
  qdRegionTagNames,
  qdSectorTagNames,
  qdStyleCustomTagNames,
  qdThemeOnlyTagNames,
  type QdBondSpectrumOption,
  type QdTagRow,
} from "@/data/qdiiFundFilterConfig";
import { qdTagLabelZh, qdTagsJoinZh } from "@/data/qdiiTagLabelsZh";
import { WhimsicalPortfolioCard } from "@/components/WhimsicalPortfolioCard";
import { WHIMSICAL_PORTFOLIOS } from "@/data/whimsicalPortfolios";
import { PerformanceCell } from "@/components/PerformanceCell";
import { perfSortValue, SortablePerfHeader, type PerfKey } from "@/components/SortablePerfHeader";
import { formatPerformanceLastUpdated } from "@/lib/formatPerformanceUpdated";
import type { FundPerformance } from "@/types/fund";

interface QdFund {
  fund_id: number;
  fund_name_cn: string;
  primary_code: string;
  sc_product_code: string;
  code?: string;
  holdings_count: number;
  as_of_date: string | null;
  tags?: string[];
  performance?: FundPerformance | null;
  holdings?: HoldingRow[];
  holdingsLoading?: boolean;
}

interface HoldingRow {
  rank: number;
  holding_name_std: string;
  holding_name_raw: string | null;
  holding_type: string;
  weight_pct: number;
  as_of_date: string;
}

interface FundNav {
  isin: string;
  ccy: string;
  dates: string[];
  navs: number[];
}
type HoldingTypeFilter = "ALL" | "EQUITY" | "BOND" | "MIXED";

function codeBadgeStyle(code: string): { bg: string; color: string; border: string } {
  const c = (code || "").toUpperCase();
  if (c.startsWith("QDUT")) return { bg: "#534AB722", color: "#AFA9EC", border: "0.5px solid rgba(83,74,183,0.35)" };
  return { bg: "#185FA522", color: "#60A5FA", border: "0.5px solid rgba(24,95,165,0.35)" };
}

function classifyHoldingTypeByTags(tags?: string[]): "EQUITY" | "BOND" | "MIXED" | "UNKNOWN" {
  const t = (tags || []).map((x) => String(x));
  const hasBond = t.some((x) => /bond|债/i.test(x));
  const hasEquity = t.some((x) => /equity|technology|ai|semiconductor|mega cap|us|asia|china/i.test(x));
  if (hasBond && hasEquity) return "MIXED";
  if (hasBond) return "BOND";
  if (hasEquity) return "EQUITY";
  return "UNKNOWN";
}

export default function QdPage() {
  const { isMobile } = useIsMobile();
  const [funds, setFunds] = useState<QdFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [allTagRows, setAllTagRows] = useState<QdTagRow[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("全部");
  const [selectedSector, setSelectedSector] = useState<string>("全部");
  const [selectedThemeOnly, setSelectedThemeOnly] = useState<string>("全部");
  const [selectedStyleCustom, setSelectedStyleCustom] = useState<string>("全部");
  const [selectedBondSpectrum, setSelectedBondSpectrum] =
    useState<QdBondSpectrumOption>("全部");
  /** 桌面端展开 / 手机端默认收起「行业 + 策略与定制」 */
  const [expandSectorStyle, setExpandSectorStyle] = useState(false);
  /** 手机端：地域 / 主题与赛道 / 固收谱系 分块折叠 */
  const [expandMobileRegion, setExpandMobileRegion] = useState(false);
  const [expandMobileTheme, setExpandMobileTheme] = useState(false);
  const [expandMobileBond, setExpandMobileBond] = useState(false);
  /** 手机端收益率筛选：字段 + 方向（与列头排序独立） */
  const [mobilePerfField, setMobilePerfField] = useState<PerfKey | null>(null);
  const [mobilePerfSign, setMobilePerfSign] = useState<"all" | "positive" | "negative">("all");
  const [expandHoldingMapNote, setExpandHoldingMapNote] = useState(false);
  const [holdingType, setHoldingType] = useState<HoldingTypeFilter>("ALL");
  const [selected, setSelected] = useState<QdFund | null>(null);
  /** 全量净值：用于分阶段收益率（不受图表范围影响） */
  const [fundNavFull, setFundNavFull] = useState<FundNav | null>(null);
  /** 按时间范围截断：用于 NavChart */
  const [fundNavChart, setFundNavChart] = useState<FundNav | null>(null);
  const [navMeta, setNavMeta] = useState<{ isin: string; ccy: string } | null>(null);
  const [navRangeDays, setNavRangeDays] = useState(365);
  const [navFullLoading, setNavFullLoading] = useState(false);
  const [navChartLoading, setNavChartLoading] = useState(false);
  const [performanceLastUpdated, setPerformanceLastUpdated] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PerfKey | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [whimsicalOpen, setWhimsicalOpen] = useState(false);

  function handlePerfSort(key: PerfKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  useEffect(() => {
    fetch("/api/qd/funds")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setFunds(d);
          setAllTagRows([]);
          setPerformanceLastUpdated(null);
        } else {
          setFunds(Array.isArray(d?.funds) ? d.funds : []);
          setPerformanceLastUpdated(
            typeof d?.performanceLastUpdated === "string" ? d.performanceLastUpdated : null
          );
          const raw = Array.isArray(d?.allTags) ? d.allTags : [];
          const rows: QdTagRow[] = raw
            .map((t: unknown) => {
              if (t && typeof t === "object" && "tag_name" in t) {
                const o = t as { tag_name: string; category?: string | null };
                return {
                  tag_name: String(o.tag_name),
                  category: String(o.category ?? ""),
                };
              }
              if (typeof t === "string") return { tag_name: t, category: "theme" };
              return null;
            })
            .filter((x: QdTagRow | null): x is QdTagRow => x != null && Boolean(x.tag_name));
          setAllTagRows(rows);
        }
        setLoading(false);
      })
      .catch(() => {
        setPerformanceLastUpdated(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setExpandSectorStyle(!isMobile);
    if (isMobile) {
      setExpandMobileRegion(false);
      setExpandMobileTheme(false);
      setExpandMobileBond(false);
    }
  }, [isMobile]);

  const regionOptions = useMemo(() => qdRegionTagNames(allTagRows), [allTagRows]);
  const sectorOptions = useMemo(() => qdSectorTagNames(allTagRows), [allTagRows]);
  const themeOnlyOptions = useMemo(() => qdThemeOnlyTagNames(allTagRows), [allTagRows]);
  const styleCustomOptions = useMemo(() => qdStyleCustomTagNames(allTagRows), [allTagRows]);

  const latestAsOf = useMemo(() => {
    const dates = funds.map((f) => f.as_of_date).filter(Boolean) as string[];
    if (!dates.length) return "—";
    return dates.sort().slice(-1)[0];
  }, [funds]);

  const withPrimaryCodeCount = useMemo(
    () => funds.filter((f) => String(f.primary_code || "").trim().length > 0).length,
    [funds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();

    return funds.filter((f) => {
      const code = String(f.primary_code || f.sc_product_code || f.code || "").toUpperCase();
      const hitSearch =
        !q || String(f.fund_name_cn || "").includes(search) || code.includes(q);
      if (!hitSearch) return false;

      if (
        !fundMatchesQdFundFilters(
          f.tags,
          selectedRegion,
          selectedSector,
          selectedThemeOnly,
          selectedStyleCustom,
          selectedBondSpectrum
        )
      ) {
        return false;
      }

      if (holdingType !== "ALL") {
        const cls = classifyHoldingTypeByTags(f.tags);
        if (holdingType === "EQUITY" && cls !== "EQUITY") return false;
        if (holdingType === "BOND" && cls !== "BOND") return false;
        if (holdingType === "MIXED" && cls !== "MIXED") return false;
      }

      if (mobilePerfField != null && mobilePerfSign !== "all") {
        const v = perfSortValue(f.performance?.[mobilePerfField]);
        if (v === null) return false;
        if (mobilePerfSign === "positive" && v <= 0) return false;
        if (mobilePerfSign === "negative" && v >= 0) return false;
      }

      return true;
    });
  }, [
    funds,
    search,
    selectedRegion,
    selectedSector,
    selectedThemeOnly,
    selectedStyleCustom,
    selectedBondSpectrum,
    holdingType,
    mobilePerfField,
    mobilePerfSign,
  ]);

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = perfSortValue(a.performance?.[sortKey]);
      const vb = perfSortValue(b.performance?.[sortKey]);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, sortKey, sortDir]);

  const handleRowClick = async (fund: QdFund) => {
    if (selected?.fund_id === fund.fund_id) {
      setSelected(null);
      setNavMeta(null);
      setFundNavFull(null);
      setFundNavChart(null);
      setNavFullLoading(false);
      setNavChartLoading(false);
      setNavRangeDays(365);
      return;
    }
    setSelected({ ...fund, holdingsLoading: true });

    // 展开后自动滚动到该行
    setTimeout(() => {
      const el = document.getElementById(`fund-row-${fund.fund_id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }
    }, 100);

    const code = String(fund.primary_code || fund.sc_product_code || fund.code || "").trim();
    if (!code) {
      setSelected({ ...fund, holdings: [], holdingsLoading: false });
      return;
    }
    try {
      const res = await fetch(`/api/mrf/holdings/${encodeURIComponent(code)}`);
      const data = await res.json();
      setSelected({ ...fund, holdings: data.holdings ?? [], holdingsLoading: false });

      // 持仓加载完后再滚动一次到 AI 分析区域
      setTimeout(() => {
        const aiEl = document.getElementById(`ai-box-${fund.fund_id}`);
        if (aiEl) aiEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    } catch {
      setSelected({ ...fund, holdings: [], holdingsLoading: false });
    }
  };

  // 解析 ISIN / 币种；换基金时重置图表范围为 1Y
  useEffect(() => {
    let cancelled = false;

    async function resolveNavMeta() {
      if (!selected) {
        setNavMeta(null);
        setNavRangeDays(365);
        return;
      }

      setNavRangeDays(365);

      const candidates = [selected.primary_code, selected.sc_product_code, selected.code]
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      let isin = "";
      let ccy = "USD";

      for (const code of candidates) {
        try {
          const res = await fetch(`/api/fund/${encodeURIComponent(code)}`);
          if (!res.ok) continue;
          const j = await res.json();
          if (j?.isin) {
            isin = String(j.isin);
            ccy = String(j.ccy || "USD");
            break;
          }
        } catch {
          // try next candidate
        }
      }

      if (!cancelled) {
        setNavMeta(isin ? { isin, ccy } : null);
      }
    }

    resolveNavMeta();
    return () => {
      cancelled = true;
    };
  }, [selected?.fund_id, selected?.primary_code, selected?.sc_product_code, selected?.code]);

  // 全量净值（days=0）→ 分阶段收益率
  useEffect(() => {
    let cancelled = false;

    async function loadFull() {
      if (!navMeta) {
        setFundNavFull(null);
        setNavFullLoading(false);
        return;
      }

      setNavFullLoading(true);
      try {
        const navRes = await fetch(
          `/api/nav/${encodeURIComponent(navMeta.isin)}?ccy=${encodeURIComponent(navMeta.ccy)}&days=0`
        );
        const d = await navRes.json();
        if (cancelled) return;

        const dates = Array.isArray(d?.dates) ? d.dates.map((x: unknown) => String(x)) : [];
        const navs = Array.isArray(d?.navs) ? d.navs.map((x: unknown) => Number(x)) : [];

        setFundNavFull({
          isin: navMeta.isin,
          ccy: navMeta.ccy,
          dates,
          navs,
        });
      } catch {
        if (!cancelled) setFundNavFull(null);
      } finally {
        if (!cancelled) setNavFullLoading(false);
      }
    }

    loadFull();
    return () => {
      cancelled = true;
    };
  }, [navMeta]);

  // 按范围净值（?days=）→ NavChart
  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      if (!navMeta) {
        setFundNavChart(null);
        setNavChartLoading(false);
        return;
      }

      setNavChartLoading(true);
      try {
        const navRes = await fetch(
          `/api/nav/${encodeURIComponent(navMeta.isin)}?ccy=${encodeURIComponent(navMeta.ccy)}&days=${navRangeDays}`
        );
        const d = await navRes.json();
        if (cancelled) return;

        const dates = Array.isArray(d?.dates) ? d.dates.map((x: unknown) => String(x)) : [];
        const navs = Array.isArray(d?.navs) ? d.navs.map((x: unknown) => Number(x)) : [];

        setFundNavChart({
          isin: navMeta.isin,
          ccy: navMeta.ccy,
          dates,
          navs,
        });
      } catch {
        if (!cancelled) setFundNavChart(null);
      } finally {
        if (!cancelled) setNavChartLoading(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [navMeta, navRangeDays]);

  const stageReturns = useMemo(() => {
    if (!fundNavFull?.navs?.length || !fundNavFull.dates.length) return null;
    const dates = fundNavFull.dates;
    const navs = fundNavFull.navs;
    const latest = navs[navs.length - 1] ?? 0;
    if (!latest) return null;

    const now = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    const shiftMonths = (base: Date, months: number) => {
      const x = new Date(base);
      x.setMonth(x.getMonth() + months);
      return x;
    };

    const lastOnOrBefore = (targetStr: string) => {
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= targetStr) return navs[i] ?? null;
      }
      return navs[0] ?? null;
    };

    const firstOnOrAfter = (targetStr: string) => {
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] >= targetStr) return navs[i] ?? null;
      }
      return navs[0] ?? null;
    };

    const pctFrom = (start: number | null) => {
      if (!start || start <= 0) return null;
      return ((latest - start) / start) * 100;
    };

    const ytdStart = `${now.getFullYear()}-01-01`;
    const ytdStartNav = firstOnOrAfter(ytdStart);

    const m1 = lastOnOrBefore(toStr(shiftMonths(now, -1)));
    const m3 = lastOnOrBefore(toStr(shiftMonths(now, -3)));
    const m6 = lastOnOrBefore(toStr(shiftMonths(now, -6)));
    const y1 = lastOnOrBefore(toStr(shiftMonths(now, -12)));

    return {
      "1M": pctFrom(m1),
      "3M": pctFrom(m3),
      "6M": pctFrom(m6),
      "1Y": pctFrom(y1),
      YTD: pctFrom(ytdStartNav),
    } as const;
  }, [fundNavFull]);

  const typeTabs: { id: HoldingTypeFilter; label: string }[] = [
    { id: "ALL", label: "全部" },
    { id: "EQUITY", label: "只看股票型" },
    { id: "BOND", label: "只看债券型" },
    { id: "MIXED", label: "混合型" },
  ];

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
    row: { display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" as const, alignItems: "center" },
    tab: { padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "0.5px solid transparent", color: "#9CA3AF", background: "transparent" },
    tabA: { padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "0.5px solid #185FA5", color: "#60A5FA", background: "#185FA522" },
    filterChips: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: 6,
      alignItems: "center",
    },
    filterSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTop: "1px solid rgba(255,255,255,0.06)",
    },
    filterLabel: {
      fontSize: 11,
      color: "#6B7280",
      marginBottom: 6,
      fontWeight: 500,
      letterSpacing: "0.04em",
    },
    input: {
      padding: "8px 14px",
      borderRadius: 8,
      border: "0.5px solid rgba(255,255,255,0.15)",
      background: "#1F2937",
      color: "#F9FAFB",
      fontSize: 13,
      width: isMobile ? ("100%" as const) : 320,
      maxWidth: "100%",
      outline: "none",
      fontFamily: "inherit",
    },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
    th: { padding: "8px 12px", textAlign: "left" as const, fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1F2937" },
    thr: { padding: "8px 12px", textAlign: "right" as const, fontSize: 10, fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.04em", borderBottom: "0.5px solid rgba(255,255,255,0.08)", background: "#1F2937" },
    td: { padding: "10px 12px", color: "#F9FAFB", borderBottom: "0.5px solid rgba(255,255,255,0.05)" },
    tdr: { padding: "10px 12px", color: "#F9FAFB", borderBottom: "0.5px solid rgba(255,255,255,0.05)", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link href="/portfolio" className="text-info hover:underline">
              ← Portfolio
            </Link>
            <h1 className="text-xl font-semibold text-white">QD 基金池</h1>
            <span />
          </div>
        </header>
        <div style={{ ...s.page, textAlign: "center", paddingTop: "4rem", color: "#9CA3AF" }}>加载 QD 基金中…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/portfolio" className="text-info hover:underline">
            ← Portfolio
          </Link>
          <h1 className="text-xl font-semibold text-white">QD 基金池</h1>
          <span />
        </div>
      </header>

      <div style={s.page}>
        {/* 指标卡 */}
        <div style={s.grid4}>
          {[
            { label: "QD 基金总数", value: `${funds.length} 只` },
            { label: "有持仓数据", value: `${withPrimaryCodeCount} 只` },
            { label: "当前筛选", value: `${filtered.length} 只` },
            { label: "最新数据截至", value: latestAsOf },
          ].map((m) => (
            <div key={m.label} style={s.metric}>
              <div style={s.mlabel}>{m.label}</div>
              <div style={s.mval}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* 奇思妙想 · 默认折叠，点击标题展开 */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={whimsicalOpen}
            aria-controls="qd-whimsical-panel"
            onClick={() => setWhimsicalOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setWhimsicalOpen((prev) => !prev);
              }
            }}
            className="group flex cursor-pointer select-none items-center justify-between py-2"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-gray-500">
                ✦ 奇思妙想 · 主题发现
              </div>
              <p className="mt-0.5 text-sm text-gray-400">
                {"五档宏观主题组合  ·  基于2026宏观三元悖论研究"}
              </p>
            </div>
            <svg
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="none"
              className={`shrink-0 text-gray-500 transition-transform duration-200 group-hover:text-gray-300 ${
                whimsicalOpen ? "rotate-180" : "rotate-0"
              }`}
              aria-hidden
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mb-3 border-b border-gray-800" />
          <div
            id="qd-whimsical-panel"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              whimsicalOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {WHIMSICAL_PORTFOLIOS.slice(0, 3).map((p) => (
                <WhimsicalPortfolioCard key={p.id} portfolio={p} />
              ))}
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 md:grid-cols-2">
              {WHIMSICAL_PORTFOLIOS.slice(3, 5).map((p) => (
                <WhimsicalPortfolioCard key={p.id} portfolio={p} />
              ))}
            </div>
          </div>
        </div>

        {/* 搜索 + 筛选（五组基金标签 + 持仓类型 + 穿透说明折叠） */}
        <div style={{ ...s.card, marginBottom: "1.25rem" }}>
          <div style={{ ...s.stitle, display: "flex", alignItems: "center", gap: 10 }}>筛选</div>
          <div
            style={{
              ...s.row,
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 14,
            }}
          >
            <p style={{ fontSize: 11, color: "#6B7280", margin: 0, maxWidth: 560, lineHeight: 1.55 }}>
              地域、行业、主题、策略与固收谱系可同时限定，逻辑为 <strong>且（AND）</strong>。基金侧使用{" "}
              <strong>Top 3</strong> 标签，各维度任命中一条即视为满足该维。固收谱系对应{" "}
              <code style={{ color: "#60A5FA" }}>tag_taxonomy</code> 中利率/主权、高收益、信用债等；与根目录{" "}
              <code style={{ color: "#60A5FA" }}>qdiiTagMap.ts</code> 持仓层债券分类概念对齐。
            </p>
            <input
              style={s.input}
              placeholder="搜索基金名或代码（QDUR/QDUT）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isMobile ? (
            <div style={{ ...s.filterSection, borderTop: "none", paddingTop: 0 }}>
              <div style={s.filterLabel}>收益率筛选</div>
              <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 8px", lineHeight: 1.45 }}>
                先选时间维度，再选涨跌方向；与表头排序可同时使用。
              </p>
              <div style={{ ...s.filterChips, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMobilePerfField(null);
                    setMobilePerfSign("all");
                  }}
                  style={mobilePerfField === null ? s.tabA : s.tab}
                >
                  不按绩效
                </button>
                {(
                  [
                    ["日涨跌", "daily_return"],
                    ["1周", "weekly_return"],
                    ["1月", "monthly_1"],
                    ["3月", "monthly_3"],
                    ["6月", "monthly_6"],
                    ["1年", "yearly_1"],
                  ] as const
                ).map(([label, key]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMobilePerfField(key)}
                    style={mobilePerfField === key ? s.tabA : s.tab}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={s.filterChips}>
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("all")}
                  style={mobilePerfSign === "all" ? s.tabA : s.tab}
                  disabled={mobilePerfField === null}
                >
                  不限方向
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("positive")}
                  style={mobilePerfSign === "positive" ? s.tabA : s.tab}
                  disabled={mobilePerfField === null}
                >
                  上涨 &gt;0
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("negative")}
                  style={mobilePerfSign === "negative" ? s.tabA : s.tab}
                  disabled={mobilePerfField === null}
                >
                  下跌 &lt;0
                </button>
              </div>
            </div>
          ) : null}

          {isMobile ? (
            <div style={s.filterSection}>
              <button
                type="button"
                onClick={() => setExpandMobileRegion((v) => !v)}
                style={{
                  ...s.tab,
                  width: "100%",
                  textAlign: "center" as const,
                  border: "0.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {expandMobileRegion ? "收起地域 ▲" : "展开地域 ▼"}
                {selectedRegion !== "全部" ? `（${qdTagLabelZh(selectedRegion)}）` : ""}
              </button>
              {expandMobileRegion ? (
                <div style={{ marginTop: 10 }}>
                  <div style={s.filterChips}>
                    <button
                      type="button"
                      onClick={() => setSelectedRegion("全部")}
                      style={selectedRegion === "全部" ? s.tabA : s.tab}
                    >
                      全部
                    </button>
                    {regionOptions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedRegion(tag)}
                        style={selectedRegion === tag ? s.tabA : s.tab}
                      >
                        {qdTagLabelZh(tag)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={s.filterSection}>
              <div style={s.filterLabel}>地域</div>
              <div style={s.filterChips}>
                <button
                  type="button"
                  onClick={() => setSelectedRegion("全部")}
                  style={selectedRegion === "全部" ? s.tabA : s.tab}
                >
                  全部
                </button>
                {regionOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedRegion(tag)}
                    style={selectedRegion === tag ? s.tabA : s.tab}
                  >
                    {qdTagLabelZh(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMobile && !expandSectorStyle ? (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setExpandSectorStyle(true)}
                style={{ ...s.tab, width: "100%", textAlign: "center" as const }}
              >
                展开行业与策略 ▼
              </button>
            </div>
          ) : null}

          {(!isMobile || expandSectorStyle) && (
            <>
              <div style={s.filterSection}>
                <div style={s.filterLabel}>行业</div>
                <div style={s.filterChips}>
                  <button
                    type="button"
                    onClick={() => setSelectedSector("全部")}
                    style={selectedSector === "全部" ? s.tabA : s.tab}
                  >
                    全部
                  </button>
                  {sectorOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedSector(tag)}
                      style={selectedSector === tag ? s.tabA : s.tab}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.filterSection}>
                <div style={s.filterLabel}>策略与定制</div>
                <div style={s.filterChips}>
                  <button
                    type="button"
                    onClick={() => setSelectedStyleCustom("全部")}
                    style={selectedStyleCustom === "全部" ? s.tabA : s.tab}
                  >
                    全部
                  </button>
                  {styleCustomOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedStyleCustom(tag)}
                      style={selectedStyleCustom === tag ? s.tabA : s.tab}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              </div>

              {isMobile ? (
                <div style={{ marginTop: 8, marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => setExpandSectorStyle(false)}
                    style={{ ...s.tab, width: "100%", textAlign: "center" as const }}
                  >
                    收起行业与策略 ▲
                  </button>
                </div>
              ) : null}
            </>
          )}

          {isMobile ? (
            <div style={s.filterSection}>
              <button
                type="button"
                onClick={() => setExpandMobileTheme((v) => !v)}
                style={{
                  ...s.tab,
                  width: "100%",
                  textAlign: "center" as const,
                  border: "0.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {expandMobileTheme ? "收起主题与赛道 ▲" : "展开主题与赛道 ▼"}
                {selectedThemeOnly !== "全部" ? `（${qdTagLabelZh(selectedThemeOnly)}）` : ""}
              </button>
              {expandMobileTheme ? (
                <div style={{ marginTop: 10 }}>
                  <div style={s.filterChips}>
                    <button
                      type="button"
                      onClick={() => setSelectedThemeOnly("全部")}
                      style={selectedThemeOnly === "全部" ? s.tabA : s.tab}
                    >
                      全部
                    </button>
                    {themeOnlyOptions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedThemeOnly(tag)}
                        style={selectedThemeOnly === tag ? s.tabA : s.tab}
                      >
                        {qdTagLabelZh(tag)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={s.filterSection}>
              <div style={s.filterLabel}>主题与赛道</div>
              <div style={s.filterChips}>
                <button
                  type="button"
                  onClick={() => setSelectedThemeOnly("全部")}
                  style={selectedThemeOnly === "全部" ? s.tabA : s.tab}
                >
                  全部
                </button>
                {themeOnlyOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedThemeOnly(tag)}
                    style={selectedThemeOnly === tag ? s.tabA : s.tab}
                  >
                    {qdTagLabelZh(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMobile ? (
            <div style={s.filterSection}>
              <button
                type="button"
                onClick={() => setExpandMobileBond((v) => !v)}
                style={{
                  ...s.tab,
                  width: "100%",
                  textAlign: "center" as const,
                  border: "0.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {expandMobileBond ? "收起固收谱系 ▲" : "展开固收谱系 ▼"}
                {selectedBondSpectrum !== "全部" ? `（${selectedBondSpectrum}）` : ""}
              </button>
              {expandMobileBond ? (
                <div style={{ marginTop: 10 }}>
                  <div style={s.filterChips}>
                    {QD_BOND_SPECTRUM_OPTIONS.map((opt) => {
                      const pendingAsia = opt === "亚洲债" && QD_BOND_SPECTRUM_GROUPS["亚洲债"].length === 0;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedBondSpectrum(opt)}
                          title={
                            pendingAsia
                              ? "待在 tag_taxonomy 增加 AsiaBond 等标签并映射基金后生效"
                              : undefined
                          }
                          style={{
                            ...(selectedBondSpectrum === opt ? s.tabA : s.tab),
                            ...(pendingAsia ? { opacity: 0.5 } : {}),
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={s.filterSection}>
              <div style={s.filterLabel}>固收谱系</div>
              <div style={s.filterChips}>
                {QD_BOND_SPECTRUM_OPTIONS.map((opt) => {
                  const pendingAsia = opt === "亚洲债" && QD_BOND_SPECTRUM_GROUPS["亚洲债"].length === 0;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedBondSpectrum(opt)}
                      title={
                        pendingAsia
                          ? "待在 tag_taxonomy 增加 AsiaBond 等标签并映射基金后生效"
                          : undefined
                      }
                      style={{
                        ...(selectedBondSpectrum === opt ? s.tabA : s.tab),
                        ...(pendingAsia ? { opacity: 0.5 } : {}),
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ ...s.row, marginBottom: 0, marginTop: 14 }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>持仓类型：</span>
            {typeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setHoldingType(t.id)}
                style={holdingType === t.id ? s.tabA : s.tab}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setExpandHoldingMapNote((v) => !v)}
              style={{
                ...s.tab,
                width: "100%",
                textAlign: "left" as const,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                按底层持仓筛选（qdiiTagMap · 占位）
              </span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>{expandHoldingMapNote ? "▲" : "▼"}</span>
            </button>
            {expandHoldingMapNote ? (
              <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.55, margin: "10px 0 0" }}>
                下一版将按基金持仓名匹配仓库根目录 <code style={{ color: "#60A5FA" }}>qdiiTagMap.ts</code>{" "}
                中的 <code style={{ color: "#60A5FA" }}>qdiiHoldingTags</code>（地域 / 主题 / 债券），与当前「基金
                Top3 标签」筛选并行。本版仅保留入口说明，避免与列表加载混淆。
              </p>
            ) : null}
          </div>
        </div>

        {/* 基金列表 */}
        <div style={{ background: "#111827", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
              {sortedFiltered.map((fund) => {
                const isSelected = selected?.fund_id === fund.fund_id;
                const code = String(fund.primary_code || fund.sc_product_code || fund.code || "—").trim();
                const badge = codeBadgeStyle(code);
                const tags = (fund.tags || []).slice(0, 3);
                return (
                  <div
                    id={`fund-row-${fund.fund_id}`}
                    key={fund.fund_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(fund)}
                    onKeyDown={(e) => e.key === "Enter" && handleRowClick(fund)}
                    style={{
                      background: isSelected ? "rgba(24,95,165,0.15)" : "#111827",
                      border: isSelected ? "1px solid rgba(24,95,165,0.45)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#F9FAFB" }}>
                      {fund.fund_name_cn}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          background: badge.bg,
                          border: badge.border,
                          color: badge.color,
                        }}
                      >
                        {code}
                      </span>
                      <span style={{ fontSize: 11, color: fund.holdings_count > 0 ? "#1D9E75" : "#6B7280" }}>
                        持仓 {fund.holdings_count} 条
                      </span>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{fund.as_of_date || "—"}</span>
                    </div>
                    {tags.length > 0 && (
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{qdTagsJoinZh(tags)}</div>
                    )}
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
                          ["日涨跌", fund.performance?.daily_return],
                          ["1周", fund.performance?.weekly_return],
                          ["1月", fund.performance?.monthly_1],
                          ["3月", fund.performance?.monthly_3],
                          ["6月", fund.performance?.monthly_6],
                          ["1年", fund.performance?.yearly_1],
                        ] as const
                      ).map(([label, v]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10, color: "#6B7280" }}>{label}</span>
                          <PerformanceCell value={v} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                      {isSelected ? "点击收起" : "点击展开"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1200px]" style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>基金名称</th>
                <th style={s.th}>产品代码</th>
                <th style={s.th}>主要标签</th>
                <th style={s.thr}>持仓数量</th>
                <th style={s.thr}>数据截至</th>
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
                <th style={s.thr}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((fund) => {
                const isSelected = selected?.fund_id === fund.fund_id;
                const code = String(fund.primary_code || fund.sc_product_code || fund.code || "—").trim();
                const badge = codeBadgeStyle(code);
                const tags = (fund.tags || []).slice(0, 3);
                const perf = fund.performance;
                return (
                  <tr
                    id={`fund-row-${fund.fund_id}`}
                    key={fund.fund_id}
                    onClick={() => handleRowClick(fund)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "rgba(24,95,165,0.12)" : "transparent",
                    }}
                  >
                    <td style={{ ...s.td, fontWeight: 500 }}>{fund.fund_name_cn}</td>
                    <td style={s.td}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          background: badge.bg,
                          border: badge.border,
                          color: badge.color,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {code}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: tags.length ? "#F9FAFB" : "#6B7280" }}>
                      {tags.length ? qdTagsJoinZh(tags) : "—"}
                    </td>
                    <td style={{ ...s.tdr, color: fund.holdings_count > 0 ? "#1D9E75" : "#6B7280" }}>{fund.holdings_count}</td>
                    <td style={{ ...s.tdr, color: "#9CA3AF", fontSize: 12 }}>{fund.as_of_date || "—"}</td>
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
                    <td style={{ ...s.tdr, color: "#9CA3AF", fontSize: 12 }}>{isSelected ? "点击收起" : "点击展开"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
          {performanceLastUpdated ? (
            <p className="mt-2 text-right text-xs text-gray-600">
              绩效数据更新时间：{formatPerformanceLastUpdated(performanceLastUpdated)} · 来源：基金公司 NAV
            </p>
          ) : null}
        </div>

        {/* 展开区 */}
        {selected && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "#1F2937",
              borderRadius: 8,
              borderLeft: "2px solid #185FA5",
            }}
          >
            {/* Block 1：基金信息卡 */}
            <div style={{ fontSize: 12, fontWeight: 500, color: "#F9FAFB", marginBottom: 8 }}>{selected.fund_name_cn}</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
                gap: 8,
              }}
            >
              {[
                ["产品代码", String(selected.primary_code || selected.sc_product_code || selected.code || "—")],
                [
                  "Top 标签",
                  (selected.tags || []).length
                    ? qdTagsJoinZh((selected.tags || []).slice(0, 3))
                    : "—",
                ],
                ["数据截至", selected.as_of_date || "—"],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, color: "#F9FAFB" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Block 1.5：净值曲线 + 分阶段收益率 */}
            <div style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    历史净值曲线
                  </div>
                  <NavChart
                    dates={fundNavChart?.dates ?? []}
                    navs={fundNavChart?.navs ?? []}
                    isin={fundNavChart?.isin}
                    height={isMobile ? 240 : 280}
                    rangeDays={navRangeDays}
                    onRangeChange={setNavRangeDays}
                    rangeLoading={navChartLoading}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    分阶段收益率
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {navFullLoading ? (
                      <div style={{ padding: 12, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.08)", background: "#111827", color: "#9CA3AF", fontSize: 12 }}>
                        加载净值数据...
                      </div>
                    ) : stageReturns ? (
                      ([
                        ["1M", "1M"],
                        ["3M", "3M"],
                        ["6M", "6M"],
                        ["1Y", "1Y"],
                        ["YTD", "YTD"],
                      ] as const).map(([k, label]) => {
                        const v = stageReturns[k];
                        const color = typeof v === "number" && v >= 0 ? "#1D9E75" : "#D85A30";
                        return (
                          <div
                            key={k}
                            style={{
                              background: "#111827",
                              border: "0.5px solid rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: typeof v === "number" ? color : "#9CA3AF" }}>
                              {typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—"}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: 12, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.08)", background: "#111827", color: "#9CA3AF", fontSize: 12 }}>
                        暂无净值数据
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2：Top 10 Holdings */}
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Top 10 Holdings
              </div>

              {selected.holdingsLoading && <div style={{ color: "#9CA3AF", fontSize: 12 }}>Loading holdings...</div>}
              {selected.holdings && selected.holdings.length > 0 && (
                isMobile ? (
                  <div>
                    {selected.holdings.slice(0, 10).map((h, i) => {
                      const nameKey = String(h.holding_name_std || h.holding_name_raw || "").trim();
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
                                  fontWeight: 500,
                                  color: "#60A5FA",
                                  textDecoration: "none",
                                }}
                              >
                                {h.holding_name_std || h.holding_name_raw}
                              </Link>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#F9FAFB" }}>
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
                    {selected.holdings.slice(0, 10).map((h, i) => {
                      const nameKey = String(h.holding_name_std || h.holding_name_raw || "").trim();
                      const ticker = getTickerFromHolding(nameKey);
                      const canClick = Boolean(ticker && isClickable(nameKey));
                      const href = canClick && ticker ? `/stock/${encodeURIComponent(ticker)}` : undefined;
                      return (
                        <tr key={i} style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "5px 8px", color: "#6B7280" }}>{h.rank ?? i + 1}</td>
                          <td style={{ padding: "5px 8px" }}>
                            {href ? (
                              <Link
                                href={href}
                                style={{ fontWeight: 500, color: "#60A5FA", textDecoration: "none" }}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`查看公开市场数据：${ticker}`}
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
                          <td style={{ padding: "5px 8px", color: "#1D9E75", textAlign: "right" }}>{Number(h.weight_pct).toFixed(2)}%</td>
                          <td style={{ padding: "5px 8px", color: "#6B7280", textAlign: "right" }}>{h.as_of_date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                )
              )}
              {selected.holdings && selected.holdings.length === 0 && !selected.holdingsLoading && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>暂无底层持仓数据</div>
              )}
            </div>

            {selected.holdings && selected.holdings.length > 0 && (
              <HoldingsDeepAnalysis
                fundName={selected.fund_name_cn}
                holdings={selected.holdings.slice(0, 10).map((h) => {
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

            {/* Block 3：通义千问 AI 分析（缓存优先） */}
            <div id={`ai-box-${selected.fund_id}`}>
              <QdAISignalBox code={String(selected.primary_code || selected.sc_product_code || selected.code || "")} />
            </div>
          </div>
        )}

        <div style={{ marginTop: "1rem", fontSize: 11, color: "#4B5563", textAlign: "center" }}>
          数据来源：本地 `qdii_portfolio/fund_tagging.db`（fund_holding_exposure + fund_tag_map + tag_taxonomy）
        </div>
      </div>
    </div>
  );
}
