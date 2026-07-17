"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ExternalLink,
  Filter,
  LineChart,
  Loader2,
  PieChart,
  Sparkles,
} from "lucide-react";
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
import { formatFundNavDisplay, formatPerfNavDate, PerformanceCell } from "@/components/PerformanceCell";
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

/** 产品代码徽章：QDUT 系列用紫色系，其余用信息蓝 */
function codeBadgeClass(code: string): string {
  const c = (code || "").toUpperCase();
  if (c.startsWith("QDUT")) {
    return "badge border border-violet-400/30 bg-violet-400/10 text-violet-300";
  }
  return "badge badge-blue";
}

/** 筛选 chip：未选中幽灵态，选中 badge-gold */
function chipClass(active: boolean, disabled = false): string {
  return [
    "badge select-none transition-colors duration-150",
    active
      ? "badge-gold cursor-pointer"
      : "cursor-pointer border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-gold/30 hover:text-slate-200",
    disabled ? "cursor-not-allowed opacity-40" : "",
  ]
    .join(" ")
    .trim();
}

/** 分组小标题：eyebrow 风格金色小字 */
const GROUP_LABEL = "mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold";

/** 详情面板分区标题 */
const SECTION_TITLE =
  "mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";

/** 手机端折叠条按钮 */
const MOBILE_COLLAPSE_BTN =
  "flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-gold/30 hover:text-slate-100";

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

  const backLink = (
    <Link href="/portfolio" className="btn-ghost">
      <ArrowLeft size={15} aria-hidden />
      Portfolio
    </Link>
  );

  const pageHeader = (
    <header className="mb-8 mt-6">
      <span className="eyebrow">QDII FUND POOL</span>
      <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">QDII 基金池</h1>
      <p className="text-sm text-slate-400 mt-2">
        跨境资产一站式纵览——按地域、行业、主题与固收谱系，透视 QDII 基金的持仓与净值表现。
      </p>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-navy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24">
          {backLink}
          {pageHeader}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            正在加载 QDII 基金池…
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton mt-6 h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "QDII 基金总数", value: String(funds.length), unit: "只" },
    { label: "有持仓数据", value: String(withPrimaryCodeCount), unit: "只" },
    { label: "当前筛选", value: String(filtered.length), unit: "只" },
    { label: "最新数据截至", value: latestAsOf, unit: "" },
  ];

  return (
    <div className="min-h-screen bg-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        {backLink}
        {pageHeader}

        {/* 指标卡 */}
        <div className="animate-in grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="glass-card p-4 sm:p-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {m.label}
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">
                {m.value}
                {m.unit ? (
                  <span className="ml-1 text-sm font-normal text-slate-500">{m.unit}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* 奇思妙想 · 默认折叠，点击标题展开 */}
        <div className="mt-6">
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
              <span className="eyebrow">
                <Sparkles size={12} aria-hidden />
                奇思妙想 · 主题发现
              </span>
              <p className="mt-1.5 text-sm text-slate-400">
                五档宏观主题组合 · 基于 2026 宏观三元悖论研究
              </p>
            </div>
            <ChevronDown
              size={16}
              aria-hidden
              className={`shrink-0 text-slate-500 transition-transform duration-200 group-hover:text-slate-300 ${
                whimsicalOpen ? "rotate-180" : ""
              }`}
            />
          </div>
          <hr className="hairline-gold mb-4" />
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
        <div className="glass-panel mt-6 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={14} className="text-gold" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              多维筛选
            </span>
          </div>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              地域、行业、主题、策略与固收谱系可同时限定，逻辑为{" "}
              <strong className="text-slate-300">且（AND）</strong>。基金侧使用{" "}
              <strong className="text-slate-300">Top 3</strong> 标签，各维度任命中一条即视为满足该维。固收谱系对应{" "}
              <code className="font-mono text-info">tag_taxonomy</code>{" "}
              中利率/主权、高收益、信用债等；与根目录{" "}
              <code className="font-mono text-info">qdiiTagMap.ts</code> 持仓层债券分类概念对齐。
            </p>
            <input
              className="w-full max-w-full rounded-xl border border-white/10 bg-navy-elevated/60 px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-gold/40 sm:w-80 sm:shrink-0"
              placeholder="搜索基金名或代码（QDUR/QDUT）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isMobile ? (
            <div>
              <div className={GROUP_LABEL}>收益率筛选</div>
              <p className="mb-2.5 text-[10px] leading-relaxed text-slate-500">
                先选时间维度，再选涨跌方向；与表头排序可同时使用。
              </p>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobilePerfField(null);
                    setMobilePerfSign("all");
                  }}
                  className={chipClass(mobilePerfField === null)}
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
                    className={chipClass(mobilePerfField === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("all")}
                  className={chipClass(mobilePerfSign === "all", mobilePerfField === null)}
                  disabled={mobilePerfField === null}
                >
                  不限方向
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("positive")}
                  className={chipClass(mobilePerfSign === "positive", mobilePerfField === null)}
                  disabled={mobilePerfField === null}
                >
                  上涨 &gt;0
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePerfSign("negative")}
                  className={chipClass(mobilePerfSign === "negative", mobilePerfField === null)}
                  disabled={mobilePerfField === null}
                >
                  下跌 &lt;0
                </button>
              </div>
            </div>
          ) : null}

          {isMobile ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setExpandMobileRegion((v) => !v)}
                className={MOBILE_COLLAPSE_BTN}
              >
                <span>
                  {expandMobileRegion ? "收起地域" : "展开地域"}
                  {selectedRegion !== "全部" ? (
                    <span className="text-gold">（{qdTagLabelZh(selectedRegion)}）</span>
                  ) : null}
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={`transition-transform duration-200 ${expandMobileRegion ? "rotate-180" : ""}`}
                />
              </button>
              {expandMobileRegion ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRegion("全部")}
                    className={chipClass(selectedRegion === "全部")}
                  >
                    全部
                  </button>
                  {regionOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedRegion(tag)}
                      className={chipClass(selectedRegion === tag)}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className={GROUP_LABEL}>地域</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRegion("全部")}
                  className={chipClass(selectedRegion === "全部")}
                >
                  全部
                </button>
                {regionOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedRegion(tag)}
                    className={chipClass(selectedRegion === tag)}
                  >
                    {qdTagLabelZh(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMobile && !expandSectorStyle ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setExpandSectorStyle(true)}
                className={MOBILE_COLLAPSE_BTN}
              >
                <span>展开行业与策略</span>
                <ChevronDown size={13} aria-hidden />
              </button>
            </div>
          ) : null}

          {(!isMobile || expandSectorStyle) && (
            <>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className={GROUP_LABEL}>行业</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSector("全部")}
                    className={chipClass(selectedSector === "全部")}
                  >
                    全部
                  </button>
                  {sectorOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedSector(tag)}
                      className={chipClass(selectedSector === tag)}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className={GROUP_LABEL}>策略与定制</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStyleCustom("全部")}
                    className={chipClass(selectedStyleCustom === "全部")}
                  >
                    全部
                  </button>
                  {styleCustomOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedStyleCustom(tag)}
                      className={chipClass(selectedStyleCustom === tag)}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              </div>

              {isMobile ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setExpandSectorStyle(false)}
                    className={MOBILE_COLLAPSE_BTN}
                  >
                    <span>收起行业与策略</span>
                    <ChevronDown size={13} aria-hidden className="rotate-180" />
                  </button>
                </div>
              ) : null}
            </>
          )}

          {isMobile ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setExpandMobileTheme((v) => !v)}
                className={MOBILE_COLLAPSE_BTN}
              >
                <span>
                  {expandMobileTheme ? "收起主题与赛道" : "展开主题与赛道"}
                  {selectedThemeOnly !== "全部" ? (
                    <span className="text-gold">（{qdTagLabelZh(selectedThemeOnly)}）</span>
                  ) : null}
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={`transition-transform duration-200 ${expandMobileTheme ? "rotate-180" : ""}`}
                />
              </button>
              {expandMobileTheme ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedThemeOnly("全部")}
                    className={chipClass(selectedThemeOnly === "全部")}
                  >
                    全部
                  </button>
                  {themeOnlyOptions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedThemeOnly(tag)}
                      className={chipClass(selectedThemeOnly === tag)}
                    >
                      {qdTagLabelZh(tag)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className={GROUP_LABEL}>主题与赛道</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedThemeOnly("全部")}
                  className={chipClass(selectedThemeOnly === "全部")}
                >
                  全部
                </button>
                {themeOnlyOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedThemeOnly(tag)}
                    className={chipClass(selectedThemeOnly === tag)}
                  >
                    {qdTagLabelZh(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMobile ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setExpandMobileBond((v) => !v)}
                className={MOBILE_COLLAPSE_BTN}
              >
                <span>
                  {expandMobileBond ? "收起固收谱系" : "展开固收谱系"}
                  {selectedBondSpectrum !== "全部" ? (
                    <span className="text-gold">（{selectedBondSpectrum}）</span>
                  ) : null}
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={`transition-transform duration-200 ${expandMobileBond ? "rotate-180" : ""}`}
                />
              </button>
              {expandMobileBond ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        className={`${chipClass(selectedBondSpectrum === opt)}${pendingAsia ? " opacity-40" : ""}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className={GROUP_LABEL}>固收谱系</div>
              <div className="flex flex-wrap items-center gap-2">
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
                      className={`${chipClass(selectedBondSpectrum === opt)}${pendingAsia ? " opacity-40" : ""}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">持仓类型</span>
            {typeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setHoldingType(t.id)}
                className={chipClass(holdingType === t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => setExpandHoldingMapNote((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-xs text-slate-400">按底层持仓筛选（qdiiTagMap · 占位）</span>
              <ChevronDown
                size={14}
                aria-hidden
                className={`text-slate-500 transition-transform duration-200 ${expandHoldingMapNote ? "rotate-180" : ""}`}
              />
            </button>
            {expandHoldingMapNote ? (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                下一版将按基金持仓名匹配仓库根目录{" "}
                <code className="font-mono text-info">qdiiTagMap.ts</code> 中的{" "}
                <code className="font-mono text-info">qdiiHoldingTags</code>
                （地域 / 主题 / 债券），与当前「基金 Top3 标签」筛选并行。本版仅保留入口说明，避免与列表加载混淆。
              </p>
            ) : null}
          </div>
        </div>

        {/* 基金列表 */}
        <div className="mt-6">
          {isMobile ? (
            <div className="flex flex-col gap-2.5">
              {sortedFiltered.map((fund) => {
                const isSelected = selected?.fund_id === fund.fund_id;
                const code = String(fund.primary_code || fund.sc_product_code || fund.code || "—").trim();
                const tags = (fund.tags || []).slice(0, 3);
                return (
                  <div
                    id={`fund-row-${fund.fund_id}`}
                    key={fund.fund_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(fund)}
                    onKeyDown={(e) => e.key === "Enter" && handleRowClick(fund)}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? "border-gold/40 bg-gold/[0.05]"
                        : "border-white/[0.07] bg-navy-card/70 hover:border-gold/25"
                    }`}
                  >
                    <div className="mb-1.5 text-sm font-medium text-slate-50">
                      {fund.fund_name_cn}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={codeBadgeClass(code)}>{code}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        NAV {formatFundNavDisplay(fund.performance?.nav)} ·{" "}
                        {formatPerfNavDate(fund.performance?.nav_date) ?? "—"}
                      </span>
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-1.5 text-[11px] text-slate-400">{qdTagsJoinZh(tags)}</div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.06] pt-2.5">
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
                        <div key={label} className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">{label}</span>
                          <PerformanceCell value={v} />
                        </div>
                      ))}
                    </div>
                    <div className={`mt-2 text-[11px] ${isSelected ? "text-gold" : "text-slate-500"}`}>
                      {isSelected ? "点击收起" : "点击展开"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="atlas-table-wrap">
              <table className="atlas-table min-w-[1220px]">
                <thead>
                  <tr>
                    <th>基金名称</th>
                    <th>产品代码</th>
                    <th>主要标签</th>
                    <th>
                      <span className="block text-right">NAV</span>
                    </th>
                    <th>
                      <span className="block text-right">NAV获得日期</span>
                    </th>
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
                    <th>
                      <span className="block text-right">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((fund) => {
                    const isSelected = selected?.fund_id === fund.fund_id;
                    const code = String(fund.primary_code || fund.sc_product_code || fund.code || "—").trim();
                    const tags = (fund.tags || []).slice(0, 3);
                    const perf = fund.performance;
                    return (
                      <tr
                        id={`fund-row-${fund.fund_id}`}
                        key={fund.fund_id}
                        onClick={() => handleRowClick(fund)}
                        className={`cursor-pointer ${isSelected ? "bg-gold/[0.06]" : ""}`}
                      >
                        <td>
                          <span className="font-medium text-slate-50">{fund.fund_name_cn}</span>
                        </td>
                        <td>
                          <span className={codeBadgeClass(code)}>{code}</span>
                        </td>
                        <td>
                          {tags.length ? (
                            <span className="text-slate-300">{qdTagsJoinZh(tags)}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="font-mono text-xs text-slate-200">
                            {formatFundNavDisplay(perf?.nav)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="font-mono text-xs text-slate-500">
                            {formatPerfNavDate(perf?.nav_date) ?? "—"}
                          </span>
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
                        <td className="text-right">
                          <span className={`text-xs ${isSelected ? "text-gold" : "text-slate-500"}`}>
                            {isSelected ? "点击收起" : "点击展开"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {performanceLastUpdated ? (
            <p className="mt-3 text-right text-[11px] text-slate-600">
              绩效数据更新时间：
              <span className="font-mono">{formatPerformanceLastUpdated(performanceLastUpdated)}</span>
              {" · 来源：基金公司 NAV"}
            </p>
          ) : null}
        </div>

        {/* 展开区 */}
        {selected && (
          <div className="glass-panel animate-in mt-6 p-5 sm:p-6">
            {/* Block 1：基金信息卡 */}
            <div className="font-display text-lg font-semibold text-slate-50">
              {selected.fund_name_cn}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(
                [
                  {
                    k: "产品代码",
                    v: String(selected.primary_code || selected.sc_product_code || selected.code || "—"),
                    mono: true,
                  },
                  {
                    k: "Top 标签",
                    v: (selected.tags || []).length
                      ? qdTagsJoinZh((selected.tags || []).slice(0, 3))
                      : "—",
                    mono: false,
                  },
                  { k: "NAV", v: formatFundNavDisplay(selected.performance?.nav), mono: true },
                  {
                    k: "NAV获得日期",
                    v: formatPerfNavDate(selected.performance?.nav_date) ?? "—",
                    mono: true,
                  },
                  { k: "持仓记录数", v: String(selected.holdings_count), mono: true },
                ] as const
              ).map(({ k, v, mono }) => (
                <div key={k}>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
                  <div className={`text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{v}</div>
                </div>
              ))}
            </div>

            <hr className="hairline-gold my-6" />

            {/* Block 1.5：净值曲线 + 分阶段收益率 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
              <div>
                <div className={SECTION_TITLE}>
                  <LineChart size={13} className="text-gold" aria-hidden />
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
                <div className={SECTION_TITLE}>
                  <BarChart3 size={13} className="text-gold" aria-hidden />
                  分阶段收益率
                </div>

                <div className="grid gap-2">
                  {navFullLoading ? (
                    <div className="skeleton h-40 rounded-xl" />
                  ) : stageReturns ? (
                    ([
                      ["1M", "1M"],
                      ["3M", "3M"],
                      ["6M", "6M"],
                      ["1Y", "1Y"],
                      ["YTD", "YTD"],
                    ] as const).map(([k, label]) => {
                      const v = stageReturns[k];
                      const isNum = typeof v === "number";
                      const tone = !isNum ? "text-slate-500" : v >= 0 ? "text-rise" : "text-fall";
                      return (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-navy-card/70 px-4 py-3"
                        >
                          <span className="text-[11px] text-slate-500">{label}</span>
                          <span className={`font-mono text-base font-semibold ${tone}`}>
                            {isNum ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-white/[0.07] bg-navy-card/70 px-4 py-3 text-xs text-slate-500">
                      暂无净值数据
                    </div>
                  )}
                </div>
              </div>
            </div>

            <hr className="hairline-gold my-6" />

            {/* Block 2：Top 10 Holdings */}
            <div>
              <div className={SECTION_TITLE}>
                <PieChart size={13} className="text-gold" aria-hidden />
                TOP 10 持仓
              </div>

              {selected.holdingsLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  正在加载持仓…
                </div>
              )}
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
                          className="flex items-center justify-between border-b border-white/[0.05] py-2.5 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="mr-1.5 font-mono text-xs text-slate-500">
                              {h.rank ?? i + 1}.
                            </span>
                            {href ? (
                              <Link
                                href={href}
                                className="text-[13px] font-medium text-info transition-colors hover:text-info/80"
                              >
                                {h.holding_name_std || h.holding_name_raw}
                              </Link>
                            ) : (
                              <span className="text-[13px] font-medium text-slate-100">
                                {h.holding_name_std || h.holding_name_raw}
                              </span>
                            )}
                            {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                              <span className="ml-1.5 font-mono text-[10px] text-slate-500">{ticker}</span>
                            )}
                          </div>
                          <div className="ml-3 text-right">
                            <div className="font-mono text-[13px] text-gold-light">
                              {Number(h.weight_pct).toFixed(2)}%
                            </div>
                            <div className="text-[10px] text-slate-500">{h.holding_type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.07]">
                        <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-slate-500">#</th>
                        <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-slate-500">持仓名称</th>
                        <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-slate-500">类型</th>
                        <th className="py-2 pl-3 text-right font-medium uppercase tracking-wider text-slate-500">权重%</th>
                        <th className="py-2 pl-3 text-right font-medium uppercase tracking-wider text-slate-500">截至日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.holdings.slice(0, 10).map((h, i) => {
                        const nameKey = String(h.holding_name_std || h.holding_name_raw || "").trim();
                        const ticker = getTickerFromHolding(nameKey);
                        const canClick = Boolean(ticker && isClickable(nameKey));
                        const href = canClick && ticker ? `/stock/${encodeURIComponent(ticker)}` : undefined;
                        return (
                          <tr key={i} className="border-b border-white/[0.05]">
                            <td className="py-2.5 pr-3 font-mono text-slate-500">{h.rank ?? i + 1}</td>
                            <td className="py-2.5 pr-3">
                              {href ? (
                                <Link
                                  href={href}
                                  className="font-medium text-info transition-colors hover:text-info/80"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`查看公开市场数据：${ticker}`}
                                >
                                  {h.holding_name_std || h.holding_name_raw}
                                  {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[11px] text-info/80">
                                      {ticker}
                                      <ExternalLink size={10} aria-hidden />
                                    </span>
                                  )}
                                </Link>
                              ) : (
                                <>
                                  <span className="font-medium text-slate-100">
                                    {h.holding_name_std || h.holding_name_raw}
                                  </span>
                                  {ticker && !["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"].includes(ticker) && (
                                    <span className="ml-1.5 font-mono text-[11px] text-slate-600">{ticker}</span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-slate-400">{h.holding_type}</td>
                            <td className="py-2.5 pl-3 text-right font-mono text-gold-light">
                              {Number(h.weight_pct).toFixed(2)}%
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono text-slate-500">{h.as_of_date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
              {selected.holdings && selected.holdings.length === 0 && !selected.holdingsLoading && (
                <div className="mt-2 text-xs text-slate-500">暂无底层持仓数据</div>
              )}
            </div>

            {selected.holdings && selected.holdings.length > 0 && (
              <HoldingsDeepAnalysis
                fundName={selected.fund_name_cn}
                productCode={String(selected.sc_product_code || selected.code || selected.primary_code || "")}
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

            <hr className="hairline-gold my-6" />

            {/* Block 3：通义千问 AI 分析（缓存优先） */}
            <div id={`ai-box-${selected.fund_id}`}>
              <div className={SECTION_TITLE}>
                <Sparkles size={13} className="text-gold" aria-hidden />
                AI 信号
              </div>
              <QdAISignalBox code={String(selected.primary_code || selected.sc_product_code || selected.code || "")} />
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-[11px] text-slate-600">
          数据来源：本地{" "}
          <span className="font-mono">qdii_portfolio/fund_tagging.db</span>
          （fund_holding_exposure + fund_tag_map + tag_taxonomy）
        </div>
      </div>
    </div>
  );
}
