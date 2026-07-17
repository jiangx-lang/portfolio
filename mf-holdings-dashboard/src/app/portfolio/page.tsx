"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Landmark,
  Globe,
  LineChart,
  Shield,
  Radio,
  BookOpen,
  Wallet,
  PieChart as PieChartIcon,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
  Activity,
} from "lucide-react";

// ── 数据 ────────────────────────────────────────
const MODEL_TARGET = {
  "平稳 (Income)": { equity: 33, bond: 58, gold: 6, cash: 3 },
  "均衡 (Balanced)": { equity: 54, bond: 38, gold: 6, cash: 2 },
  "进取 (Aggressive)": { equity: 74, bond: 17, gold: 6, cash: 3 },
} as const;

const MODEL_DETAIL = {
  "平稳 (Income)": {
    equity: {
      "North America": 14,
      "Europe ex-UK": 3,
      UK: 1,
      Japan: 1,
      "Asia ex-Japan": 4,
    },
    bond: {
      "DM IG Gov": 25,
      "DM IG Corp": 10,
      "DM HY Corp": 1,
      "EM USD Gov": 8,
      "EM Local": 6,
      "Asia USD": 8,
    },
  },
  "均衡 (Balanced)": {
    equity: {
      "North America": 38,
      "Europe ex-UK": 6,
      UK: 1,
      Japan: 2,
      "Asia ex-Japan": 7,
    },
    bond: {
      "DM IG Gov": 16,
      "DM IG Corp": 5,
      "DM HY Corp": 1,
      "EM USD Gov": 6,
      "EM Local": 5,
      "Asia USD": 5,
    },
  },
  "进取 (Aggressive)": {
    equity: {
      "North America": 51,
      "Europe ex-UK": 8,
      UK: 2,
      Japan: 3,
      "Asia ex-Japan": 10,
    },
    bond: {
      "DM IG Gov": 8,
      "DM IG Corp": 1,
      "EM USD Gov": 4,
      "EM Local": 2,
      "Asia USD": 3,
    },
  },
} as const;

type MrfPoolEntry = {
  brand: string;
  equity: number;
  bond: number;
  cash: number;
  fee: number;
};

const MRF_POOL: Record<string, MrfPoolEntry> = {
  "东方汇理香港组合-灵活配置增长": { brand: "Amundi", equity: 70, bond: 25, cash: 5, fee: 3.0 },
  "东方汇理香港组合-灵活配置均衡": { brand: "Amundi", equity: 50, bond: 45, cash: 5, fee: 3.0 },
  "东方汇理香港组合-灵活配置平稳": { brand: "Amundi", equity: 30, bond: 60, cash: 10, fee: 3.0 },
  "东亚联丰环球股票基金": { brand: "BEA", equity: 95, bond: 0, cash: 5, fee: 2.5 },
  "惠理高息股票基金": { brand: "VP", equity: 95, bond: 0, cash: 5, fee: 2.5 },
  "惠理价值基金": { brand: "VP", equity: 95, bond: 0, cash: 5, fee: 2.5 },
  "摩根太平洋科技": { brand: "JPM", equity: 95, bond: 0, cash: 5, fee: 2.5 },
  "摩根太平洋证券": { brand: "JPM", equity: 95, bond: 0, cash: 5, fee: 1.5 },
  "摩根亚洲股息": { brand: "JPM", equity: 95, bond: 0, cash: 5, fee: 2.5 },
  "摩根亚洲总收益": { brand: "JPM", equity: 50, bond: 45, cash: 5, fee: 1.0 },
  "瑞士百达策略收益基金": { brand: "Pictet", equity: 40, bond: 50, cash: 10, fee: 3.0 },
  "中银香港环球股票基金": { brand: "BOC", equity: 95, bond: 0, cash: 5, fee: 1.5 },
  "中银香港香港股票基金": { brand: "BOC", equity: 95, bond: 0, cash: 5, fee: 1.5 },
  "施罗德亚洲高息股债基金M类别(人民币派息)": {
    brand: "Schroders",
    equity: 64,
    bond: 23,
    cash: 13,
    fee: 2.0,
  },
  "摩根国际债": { brand: "JPM", equity: 0, bond: 95, cash: 5, fee: 2.0 },
};

type RiskKey = keyof typeof MODEL_TARGET;
type ComputeResult = {
  funds: string[];
  weights: number[];
  achieved: { equity: number; bond: number; cash: number };
  avgFee: number;
};

// ── 简化的最优化算法（贪心法）──────────────────
function computePortfolio(
  riskLevel: string,
  mode: "fee_first" | "optimal" | "diversify",
  usedFunds: Set<string> = new Set()
): ComputeResult {
  const target = MODEL_TARGET[riskLevel as RiskKey];
  if (!target) {
    return { funds: [], weights: [], achieved: { equity: 0, bond: 0, cash: 0 }, avgFee: 0 };
  }

  let pool = Object.keys(MRF_POOL).filter((f) => f !== "东亚联丰亚洲债券及货币基金");

  if (mode === "fee_first") {
    pool = pool.filter((f) => MRF_POOL[f].fee >= 2.5 && f !== "摩根国际债");
    const hasBond = pool.some((f) => MRF_POOL[f].bond > 60);
    if (!hasBond && !pool.includes("东方汇理香港组合-灵活配置平稳")) {
      pool = [...pool, "东方汇理香港组合-灵活配置平稳"];
    }
  } else if (mode === "diversify") {
    pool = pool.filter(
      (f) =>
        !usedFunds.has(f) && MRF_POOL[f].fee >= 1.5 && MRF_POOL[f].fee <= 3.0
    );
    if (pool.length < 2) {
      pool = Object.keys(MRF_POOL).filter((f) => !usedFunds.has(f));
    }
  }

  if (pool.length === 0) {
    pool = Object.keys(MRF_POOL);
  }

  const equityFunds = pool
    .filter((f) => MRF_POOL[f].equity > 60)
    .sort((a, b) => MRF_POOL[b].fee - MRF_POOL[a].fee);
  const bondFunds = pool
    .filter((f) => MRF_POOL[f].bond > 40)
    .sort((a, b) => MRF_POOL[b].fee - MRF_POOL[a].fee);
  const mixedFunds = pool.filter(
    (f) => MRF_POOL[f].equity >= 30 && MRF_POOL[f].equity <= 70
  );

  const selected: string[] = [];
  const weights: number[] = [];

  const equityNeeded = target.equity / 100;
  const bondNeeded = target.bond / 100;

  if (equityFunds.length > 0 && equityNeeded > 0) {
    const topEquity = equityFunds[0];
    selected.push(topEquity);
    weights.push(equityNeeded);
  }

  if (bondFunds.length > 0 && bondNeeded > 0) {
    const topBond = bondFunds[0];
    if (!selected.includes(topBond)) {
      selected.push(topBond);
      weights.push(bondNeeded);
    }
  }

  if (mixedFunds.length > 0 && selected.length < 3) {
    for (const mf of mixedFunds) {
      if (!selected.includes(mf)) {
        selected.push(mf);
        const remaining = 1 - weights.reduce((a, b) => a + b, 0);
        if (remaining > 0.05) weights.push(Math.min(remaining, 0.2));
        break;
      }
    }
  }

  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const normWeights = weights.map((w) => w / total);

  const achieved = { equity: 0, bond: 0, cash: 0 };
  selected.forEach((f, i) => {
    achieved.equity += MRF_POOL[f].equity * normWeights[i];
    achieved.bond += MRF_POOL[f].bond * normWeights[i];
    achieved.cash += MRF_POOL[f].cash * normWeights[i];
  });

  const avgFee = selected.reduce(
    (sum, f, i) => sum + MRF_POOL[f].fee * normWeights[i],
    0
  );

  return { funds: selected, weights: normWeights, achieved, avgFee };
}

const BRAND_COLORS: Record<string, string> = {
  Amundi: "#185FA5",
  JPM: "#C9A84C",
  Pictet: "#1D9E75",
  BEA: "#9333EA",
  VP: "#D85A30",
  Schroders: "#0891B2",
  BOC: "#DC2626",
};

/* recharts 深色玻璃 tooltip（表现层组件） */
type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-panel px-3 py-2 text-xs shadow-card">
      {label ? (
        <div className="mb-1 font-semibold text-slate-200">{label}</div>
      ) : null}
      {payload.map((p, i) => {
        const dot =
          p.color ??
          (typeof p.payload?.color === "string"
            ? (p.payload.color as string)
            : "#C9A84C");
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: dot }}
            />
            <span className="text-slate-400">{p.name}</span>
            <span className="ml-auto pl-3 font-mono font-semibold text-slate-100">
              {p.value}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { isMobile } = useIsMobile();
  const [riskLevel, setRiskLevel] = useState<RiskKey>("平稳 (Income)");
  const [activeTab, setActiveTab] = useState<"t1" | "t2" | "t3">("t1");
  const [capital, setCapital] = useState(1_000_000);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(100);

  const res1 = useMemo(
    () => computePortfolio(riskLevel, "fee_first"),
    [riskLevel]
  );
  const res2 = useMemo(
    () => computePortfolio(riskLevel, "optimal"),
    [riskLevel]
  );
  const res3 = useMemo(() => {
    const used = new Set([...res1.funds, ...res2.funds]);
    return computePortfolio(riskLevel, "diversify", used);
  }, [riskLevel, res1.funds, res2.funds]);

  const target = MODEL_TARGET[riskLevel];
  const activeRes = activeTab === "t1" ? res1 : activeTab === "t2" ? res2 : res3;

  /* 金 / 蓝 / 石板高级暗色盘（令牌色） */
  const allocationData = [
    { name: "股票", value: target.equity, color: "#5B93F0" },
    { name: "债券", value: target.bond, color: "#C9A84C" },
    { name: "黄金", value: target.gold, color: "#E3C87A" },
    { name: "现金", value: target.cash, color: "#64748B" },
  ];

  const penetrationData = [
    {
      name: "股票",
      target: target.equity,
      achieved: Math.round(activeRes.achieved.equity),
    },
    {
      name: "债券",
      target: target.bond,
      achieved: Math.round(activeRes.achieved.bond),
    },
    {
      name: "现金+黄金",
      target: target.cash + target.gold,
      achieved: Math.round(activeRes.achieved.cash),
    },
  ];

  const detail = MODEL_DETAIL[riskLevel];

  const quickLinks = [
    { label: "MRF 基金", href: "/mrf", icon: Landmark },
    { label: "QD 基金", href: "/qd", icon: Globe },
    { label: "市场资讯", href: "/notes", icon: LineChart },
    { label: "Risk", href: "/risk", icon: Shield },
    { label: "播客", href: "/podcast", icon: Radio },
    { label: "笔记", href: "/notes?tab=notes", icon: BookOpen },
  ];

  const tabs = [
    {
      id: "t1" as const,
      label: isMobile ? "手续费优先" : "精选 Portfolio（手续费优先）",
      icon: Wallet,
    },
    {
      id: "t2" as const,
      label: isMobile ? "Model" : "Model Portfolio（最优匹配）",
      icon: PieChartIcon,
    },
    {
      id: "t3" as const,
      label: isMobile ? "补充" : "补充 Portfolio（差异化配置）",
      icon: RefreshCw,
    },
  ];

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 animate-in">
        {/* ── 页头 ─────────────────────────── */}
        <header className="mb-8">
          <span className="eyebrow">MODEL PORTFOLIO</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">
            Model Portfolio · 标准组合
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Model Portfolio 数据展示 · 市场资讯分享 · 不构成任何投资建议
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
            <span>
              当前基准：
              <span className="font-semibold text-slate-100">{riskLevel}</span>
            </span>
            <span>
              股票{" "}
              <span className="font-mono font-semibold text-info">
                {target.equity}%
              </span>
            </span>
            <span>
              债券{" "}
              <span className="font-mono font-semibold text-gold">
                {target.bond}%
              </span>
            </span>
            <span>
              黄金{" "}
              <span className="font-mono font-semibold text-gold-light">
                {target.gold}%
              </span>
            </span>
            <span>
              现金{" "}
              <span className="font-mono font-semibold text-slate-400">
                {target.cash}%
              </span>
            </span>
          </div>
        </header>

        {/* ── 策略选择 ─────────────────────── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
            选择投资目标基准
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {(Object.keys(MODEL_TARGET) as RiskKey[]).map((level) => {
              const t = MODEL_TARGET[level];
              const active = riskLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRiskLevel(level)}
                  className={`glass-card relative w-full text-left p-4 sm:p-5 ${
                    active ? "glow-border border-gold/50" : ""
                  }`}
                >
                  {active && (
                    <span className="badge badge-gold absolute top-3 right-3">
                      <Check size={11} />
                      当前基准
                    </span>
                  )}
                  <div className="font-display text-lg font-bold text-slate-100">
                    {level}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(
                      [
                        ["股票", t.equity, "text-info"],
                        ["债券", t.bond, "text-gold"],
                        ["黄金", t.gold, "text-gold-light"],
                        ["现金", t.cash, "text-slate-400"],
                      ] as const
                    ).map(([name, v, cls]) => (
                      <div key={name}>
                        <div className="text-[10px] text-slate-500">{name}</div>
                        <div className={`font-mono text-sm font-semibold ${cls}`}>
                          {v}%
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 标准配置 + 快捷入口 ───────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-4">
              <PieChartIcon size={14} className="text-gold" />
              标准配置
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="h-[190px] w-full max-w-[230px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      dataKey="value"
                      paddingAngle={2}
                      nameKey="name"
                      strokeWidth={0}
                    >
                      {allocationData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full">
                {allocationData.map(({ name, value, color }) => (
                  <div
                    key={name}
                    className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-slate-300">{name}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-100">
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <details className="mt-4 text-xs text-slate-500">
              <summary className="cursor-pointer select-none text-slate-400 transition hover:text-gold-light">
                股票地区 / 债券分类明细（目标基准）
              </summary>
              <div className="mt-3 leading-relaxed">
                <div className="mb-2 text-slate-400">股票地区</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.equity).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {k} {v}%
                    </span>
                  ))}
                </div>
                <div className="mb-2 mt-3 text-slate-400">债券</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.bond).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {k} {v}%
                    </span>
                  ))}
                </div>
              </div>
            </details>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-4">
              <Globe size={14} className="text-gold" />
              快捷入口
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {quickLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-xs text-slate-300 transition hover:border-gold/40 hover:text-gold-light"
                >
                  <Icon size={13} className="text-slate-500" />
                  {label}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              跨基金池与资讯模块快速跳转，随时对照基准审视持仓与风险。
            </p>
          </div>
        </section>

        {/* ── 加权费率计算器 ────────────────── */}
        <section className="glass-panel p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Wallet size={14} className="text-gold" />
              参考投资金额
            </span>
            {[50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCapital(preset * 10000);
                  setSelectedPreset(preset);
                  setCustomAmount("");
                }}
                className={`rounded-lg border px-3.5 py-1.5 font-mono text-sm transition ${
                  selectedPreset === preset
                    ? "border-gold/50 bg-gold/10 text-gold-light"
                    : "border-white/[0.07] text-slate-400 hover:border-gold/25 hover:text-slate-200"
                }`}
              >
                ¥{preset}万
              </button>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">自定义 ¥</span>
              <input
                type="number"
                placeholder="金额（万）"
                value={customAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setCapital(val * 10000);
                    setCustomAmount(e.target.value);
                    setSelectedPreset(null);
                  } else {
                    setCustomAmount(e.target.value);
                  }
                }}
                className={`w-28 rounded-lg border bg-navy-elevated px-3 py-1.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none transition ${
                  customAmount && selectedPreset === null
                    ? "border-gold/50"
                    : "border-white/[0.07] focus:border-gold/40"
                }`}
              />
              <span className="text-sm text-slate-500">万</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={12} className="text-gold" />
              仅供参考，不构成建议
            </span>
          </div>
        </section>

        {/* ── 组合方案 ─────────────────────── */}
        <section className="glass-panel p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition ${
                  activeTab === id
                    ? "border-gold/50 bg-gold/10 font-semibold text-gold-light"
                    : "border-white/[0.07] text-slate-400 hover:border-gold/25 hover:text-slate-200"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <PortfolioTab
            res={activeRes}
            target={target}
            capital={capital}
            isMobile={isMobile}
            penetrationData={penetrationData}
            onFundClick={(fund) =>
              router.push(`/mrf?fund=${encodeURIComponent(fund)}`)
            }
          />
        </section>

        {/* ── 免责声明 ─────────────────────── */}
        <div className="mt-8 flex items-start gap-2.5 rounded-2xl border border-gold/20 bg-gold/[0.05] px-4 py-3 text-xs leading-relaxed text-slate-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold" />
          <p>
            本平台所有内容仅为市场数据展示与资讯分享，不构成任何投资建议。投资涉及风险，请咨询持牌理财顾问后自行决策。
          </p>
        </div>
      </div>
    </div>
  );
}

function PortfolioTab({
  res,
  target,
  capital,
  isMobile,
  penetrationData,
  onFundClick,
}: {
  res: ComputeResult;
  target: { equity: number; bond: number; gold: number; cash: number };
  capital: number;
  isMobile: boolean;
  penetrationData: { name: string; target: number; achieved: number }[];
  onFundClick: (fund: string) => void;
}) {
  const { funds, weights, avgFee } = res;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── MRF 落地基金 · 手续费排名表 ── */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
          <Wallet size={13} className="text-gold" />
          建议落地基金
        </h3>

        <div className="atlas-table-wrap">
          <table className="atlas-table">
            <thead>
              <tr>
                <th>基金</th>
                <th>品牌</th>
                <th>手续费</th>
                <th>权重</th>
                <th>参考金额</th>
                <th>股 · 债 · 现</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {funds.map((fund, i) => {
                const info = MRF_POOL[fund];
                if (!info) return null;
                const weight = Math.round(weights[i] * 100);
                const amount = Math.round(capital * weights[i]);
                const fee = info.fee;
                const brandColor = BRAND_COLORS[info.brand] || "#64748B";

                return (
                  <tr
                    key={fund}
                    role="button"
                    tabIndex={0}
                    onClick={() => onFundClick(fund)}
                    onKeyDown={(e) => e.key === "Enter" && onFundClick(fund)}
                    className="cursor-pointer"
                  >
                    <td className="min-w-[150px] font-medium text-slate-200">{fund}</td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: brandColor }}
                        />
                        {info.brand}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {fee >= 3.0 ? (
                        <span className="badge badge-gold font-mono">
                          {fee.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="font-mono text-slate-300">
                          {fee.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-slate-100">
                        {weight}%
                      </div>
                      <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${weight}%`,
                            backgroundColor: brandColor,
                          }}
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap font-mono text-slate-300">
                      ¥{amount / 10000}万
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-500">
                      股{info.equity}% · 债{info.bond}% · 现{info.cash}%
                    </td>
                    <td className="whitespace-nowrap">
                      <ArrowRight size={14} className="text-slate-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3">
          <span className="text-sm text-slate-400">组合加权手续费</span>
          <span className="font-mono text-xl font-bold text-gold">
            {avgFee.toFixed(2)}%
          </span>
        </div>
        <p className="mt-1.5 text-right text-xs text-slate-500">
          一次性约{" "}
          <span className="font-mono">
            ¥{((capital * avgFee) / 100 / 10000).toFixed(1)}
          </span>
          万
        </p>
      </div>

      {/* ── 情景分析 · 穿透汇总 vs 基准 ── */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
          <Activity size={13} className="text-gold" />
          穿透汇总 vs 标准基准
        </h3>

        {penetrationData.map(({ name, target: tgt, achieved: ach }) => {
          const diff = ach - tgt;
          const ok = Math.abs(diff) <= 5;
          return (
            <div
              key={name}
              className="border-b border-white/[0.05] py-2.5 last:border-b-0"
            >
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-300">{name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    基准 <span className="font-mono">{tgt}%</span>
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-100">
                    {ach}%
                  </span>
                  <span
                    className={`badge font-mono ${
                      ok ? "badge-green" : "badge-red"
                    }`}
                  >
                    {diff >= 0 ? "+" : ""}
                    {diff.toFixed(1)}%{ok ? " 达标" : diff > 0 ? " 超配" : " 欠配"}
                  </span>
                </div>
              </div>
              <div className="relative h-1.5">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/[0.10]"
                  style={{ width: `${Math.min(tgt, 100)}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${
                    ok ? "bg-fall" : "bg-rise"
                  }`}
                  style={{ width: `${Math.min(ach, 100)}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="mt-4 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={penetrationData}
              barSize={isMobile ? 16 : 20}
              margin={{ top: 5, right: 10, bottom: 5, left: -12 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<GlassTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar
                dataKey="target"
                name="基准"
                fill="rgba(148,163,194,0.22)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="achieved"
                name="穿透后"
                fill="#C9A84C"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400/60" />
            基准
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" />
            穿透后
          </span>
        </div>
      </div>
    </div>
  );
}
