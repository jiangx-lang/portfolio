"use client";

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
  Legend,
} from "recharts";

const STREAMLIT_URL =
  process.env.NEXT_PUBLIC_STREAMLIT_URL || "https://streamlit.atlasallocations.com";

// ── 数据 ────────────────────────────────────────
const SCB_TARGET = {
  "平稳 (Income)": { equity: 33, bond: 58, gold: 6, cash: 3 },
  "均衡 (Balanced)": { equity: 54, bond: 38, gold: 6, cash: 2 },
  "进取 (Aggressive)": { equity: 74, bond: 17, gold: 6, cash: 3 },
} as const;

const SCB_DETAIL = {
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

type RiskKey = keyof typeof SCB_TARGET;
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
  const target = SCB_TARGET[riskLevel as RiskKey];
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

  const target = SCB_TARGET[riskLevel];
  const activeRes = activeTab === "t1" ? res1 : activeTab === "t2" ? res2 : res3;

  const allocationData = [
    { name: "股票", value: target.equity, color: "#185FA5" },
    { name: "债券", value: target.bond, color: "#1D9E75" },
    { name: "黄金", value: target.gold, color: "#C9A84C" },
    { name: "现金", value: target.cash, color: "#6B7280" },
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

  const detail = SCB_DETAIL[riskLevel];

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0e1a",
      color: "#F9FAFB",
      paddingBottom: isMobile ? 80 : 40,
    },
    hero: {
      padding: isMobile ? "1.5rem 1rem" : "2rem 2.5rem",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "linear-gradient(180deg, #0d1829 0%, #0a0e1a 100%)",
    },
    heroLabel: {
      fontSize: 11,
      color: "#185FA5",
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: isMobile ? 22 : 28,
      fontWeight: 700,
      color: "#F9FAFB",
      margin: "0 0 6px",
    },
    heroSub: {
      fontSize: 13,
      color: "#6B7280",
      margin: "0 0 20px",
    },
    riskBar: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap" as const,
    },
    riskBtn: (active: boolean) =>
      ({
        padding: isMobile ? "8px 14px" : "7px 18px",
        borderRadius: 8,
        border: `1px solid ${active ? "#185FA5" : "rgba(255,255,255,0.08)"}`,
        background: active ? "rgba(24,95,165,0.2)" : "transparent",
        color: active ? "#60A5FA" : "#9CA3AF",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }) as React.CSSProperties,
    body: {
      padding: isMobile ? "1rem" : "1.5rem 2.5rem",
      maxWidth: 1400,
      margin: "0 auto",
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: 16,
      marginBottom: 16,
    },
    card: {
      background: "#111827",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "1rem 1.25rem",
    },
    cardTitle: {
      fontSize: 12,
      color: "#6B7280",
      fontWeight: 500,
      letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      marginBottom: 12,
    },
    tabBar: {
      display: "flex",
      gap: 0,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      marginBottom: 16,
      overflowX: "auto" as const,
    },
    tabBtn: (active: boolean) =>
      ({
        padding: "10px 16px 10px",
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #185FA5" : "2px solid transparent",
        color: active ? "#F9FAFB" : "#6B7280",
        cursor: "pointer",
        fontSize: isMobile ? 12 : 13,
        fontWeight: active ? 600 : 400,
        fontFamily: "inherit",
        whiteSpace: "nowrap" as const,
      }) as React.CSSProperties,
  };

  const externalLinks = [
    { label: "🏦 MRF 基金", href: "/mrf" },
    { label: "📁 QD 基金", href: "/qd" },
    { label: "📰 市场资讯", href: STREAMLIT_URL, external: true },
    { label: "📈 Risk", href: "/risk" },
    { label: "🎙️ 播客", href: STREAMLIT_URL, external: true },
    { label: "📝 笔记", href: STREAMLIT_URL, external: true },
  ];

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={s.heroLabel}>ATLAS · MARKET PORTFOLIO</div>
          <h1 style={s.heroTitle}>Model Portfolio · 市场信息参考</h1>
          <p style={s.heroSub}>
             Model Portfolio 数据展示 · 市场资讯分享 · 不构成任何投资建议
          </p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              选择 SCB 投资目标基准：
            </div>
            <div style={s.riskBar}>
              {(Object.keys(SCB_TARGET) as RiskKey[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  style={s.riskBtn(riskLevel === level)}
                  onClick={() => setRiskLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              fontSize: 13,
              color: "#9CA3AF",
            }}
          >
            <span>
              当前基准：
              <strong style={{ color: "#F9FAFB" }}> - {riskLevel}</strong>
            </span>
            <span>
              股票 <strong style={{ color: "#185FA5" }}>{target.equity}%</strong>
            </span>
            <span>
              债券 <strong style={{ color: "#1D9E75" }}>{target.bond}%</strong>
            </span>
            <span>
              黄金 <strong style={{ color: "#C9A84C" }}>{target.gold}%</strong>
            </span>
            <span>
              现金 <strong style={{ color: "#6B7280" }}>{target.cash}%</strong>
            </span>
          </div>
        </div>
      </div>

      <div style={s.body}>
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.cardTitle}>SCB 标准配置</div>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ width: "100%", maxWidth: isMobile ? 280 : 200, height: 180, margin: "0 auto" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                      nameKey="name"
                    >
                      {allocationData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#1F2937",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}%`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, width: "100%" }}>
                {allocationData.map(({ name, value, color }) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: color,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: 13, color: "#E5E7EB" }}>
                        {name}
                      </span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color }}>
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
              <details style={{ marginTop: 12, fontSize: 11, color: "#6B7280" }}>
                <summary style={{ cursor: "pointer", color: "#9CA3AF" }}>
                  股票地区 / 债券分类明细（SCB）
                </summary>
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 6 }}>股票地区：</div>
                  {Object.entries(detail.equity).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 8 }}>
                      {k} {v}%
                    </span>
                  ))}
                  <div style={{ margin: "8px 0 6px" }}>债券：</div>
                  {Object.entries(detail.bond).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 8 }}>
                      {k} {v}%
                    </span>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>快捷入口</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {externalLinks.map(({ label, href, external }) => (
                <a
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.02)",
                    textDecoration: "none",
                    color: "#E5E7EB",
                    fontSize: 12,
                    gap: 4,
                    transition: "all 0.15s",
                    cursor: "pointer",
                    textAlign: "center" as const,
                  }}
                >
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>参考投资金额：</span>
            {[50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setCapital(preset * 10000);
                  setSelectedPreset(preset);
                  setCustomAmount("");
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${
                    selectedPreset === preset
                      ? "#185FA5"
                      : "rgba(255,255,255,0.08)"
                  }`,
                  background:
                    selectedPreset === preset
                      ? "rgba(24,95,165,0.15)"
                      : "transparent",
                  color: selectedPreset === preset ? "#60A5FA" : "#9CA3AF",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ¥{preset}万
              </button>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <span style={{ color: "#64748b", fontSize: 13 }}>自定义：¥</span>
              <input
                type="number"
                placeholder="输入金额（万）"
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
                style={{
                  width: 100,
                  background: "#0f2744",
                  color: "#e2e8f0",
                  border: `1px solid ${
                    customAmount && selectedPreset === null
                      ? "#3b82f6"
                      : "#1e3a5f"
                  }`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
              <span style={{ color: "#64748b", fontSize: 13 }}>万</span>
            </div>
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              ⚠️ 仅供参考，不构成建议
            </span>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.tabBar}>
            {(
              [
                {
                  id: "t1" as const,
                  label: isMobile
                    ? "💰 手续费优先"
                    : "💰 精选 Portfolio（手续费优先）",
                },
                {
                  id: "t2" as const,
                  label: isMobile ? "🎯 Model" : "🎯 Model Portfolio（最优匹配）",
                },
                {
                  id: "t3" as const,
                  label: isMobile ? "🔄 补充" : "🔄 补充 Portfolio（差异化配置）",
                },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                style={s.tabBtn(activeTab === id)}
                onClick={() => setActiveTab(id)}
              >
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
        </div>

        <div
          style={{
            marginTop: 24,
            padding: "12px 16px",
            background: "rgba(186, 117, 23, 0.06)",
            border: "1px solid rgba(186, 117, 23, 0.15)",
            borderRadius: 8,
            fontSize: 12,
            color: "#9CA3AF",
            textAlign: "center" as const,
            lineHeight: 1.6,
          }}
        >
          ⚠️ 本平台所有内容仅为市场数据展示与资讯分享，不构成任何投资建议。
          投资涉及风险，请咨询持牌理财顾问后自行决策。
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
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 20,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#6B7280",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            建议落地基金
          </div>

          {funds.map((fund, i) => {
            const info = MRF_POOL[fund];
            if (!info) return null;
            const weight = Math.round(weights[i] * 100);
            const amount = Math.round(capital * weights[i]);
            const fee = info.fee;

            return (
              <div
                key={fund}
                role="button"
                tabIndex={0}
                onClick={() => onFundClick(fund)}
                onKeyDown={(e) => e.key === "Enter" && onFundClick(fund)}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <span
                      style={{
                        fontSize: isMobile ? 13 : 14,
                        color: "#E5E7EB",
                        fontWeight: 500,
                        display: "block",
                        lineHeight: 1.4,
                      }}
                    >
                      {fund}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: `${BRAND_COLORS[info.brand] || "#6B7280"}22`,
                          color: BRAND_COLORS[info.brand] || "#9CA3AF",
                          border: `1px solid ${BRAND_COLORS[info.brand] || "#6B7280"}44`,
                        }}
                      >
                        {info.brand}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background:
                            fee >= 3.0
                              ? "rgba(201,168,76,0.15)"
                              : "rgba(107,114,128,0.1)",
                          color: fee >= 3.0 ? "#C9A84C" : "#9CA3AF",
                          border: `1px solid ${
                            fee >= 3.0 ? "#C9A84C44" : "transparent"
                          }`,
                        }}
                      >
                        {fee >= 3.0 ? "⭐ " : ""}
                        {fee.toFixed(1)}% 手续费
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#F9FAFB",
                      }}
                    >
                      {weight}%
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>
                      ¥{amount / 10000}万
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    height: 3,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${weight}%`,
                      background: BRAND_COLORS[info.brand] || "#185FA5",
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: "#6B7280",
                    marginTop: 4,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span>股{info.equity}%</span>
                  <span>债{info.bond}%</span>
                  <span>现{info.cash}%</span>
                  <span style={{ marginLeft: "auto", color: "#60A5FA" }}>
                    查看持仓 →
                  </span>
                </div>
              </div>
            );
          })}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "rgba(201, 168, 76, 0.08)",
              border: "1px solid rgba(201, 168, 76, 0.15)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>组合加权手续费</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#C9A84C" }}>
              {avgFee.toFixed(2)}%
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#4B5563",
              marginTop: 4,
              textAlign: "right",
            }}
          >
            一次性约 ¥{((capital * avgFee) / 100 / 10000).toFixed(1)}万
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              color: "#6B7280",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            穿透汇总 vs 标准基准
          </div>

          {penetrationData.map(({ name, target: tgt, achieved: ach }) => {
            const diff = ach - tgt;
            const ok = Math.abs(diff) <= 5;
            return (
              <div
                key={name}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#9CA3AF" }}>{name}</span>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    <span style={{ fontSize: 12, color: "#6B7280" }}>
                      基准 {tgt}%
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#F9FAFB",
                      }}
                    >
                      {ach}%
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: ok
                          ? "rgba(29,158,117,0.15)"
                          : "rgba(216,90,48,0.15)",
                        color: ok ? "#1D9E75" : "#D85A30",
                      }}
                    >
                      {diff >= 0 ? "+" : ""}
                      {diff.toFixed(1)}%
                      {ok ? " ✓" : diff > 0 ? " 超配" : " 欠配"}
                    </span>
                  </div>
                </div>
                <div style={{ position: "relative", height: 6, marginBottom: 2 }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${Math.min(tgt, 100)}%`,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 3,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${Math.min(ach, 100)}%`,
                      background: ok ? "#1D9E75" : "#D85A30",
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={penetrationData}
                barSize={isMobile ? 16 : 20}
                margin={{ top: 5, right: 10, bottom: 5, left: -12 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} />
                <Tooltip
                  contentStyle={{
                    background: "#1F2937",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, ""]}
                />
                <Bar dataKey="target" name="基准" fill="rgba(255,255,255,0.12)" />
                <Bar dataKey="achieved" name="穿透后" fill="#185FA5" />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
