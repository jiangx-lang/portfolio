"use client";

import { useMemo, useState } from "react";
import type { OptionsContract, StrategyCard, IVStats, AISignal } from "@/types";
import { IVGauge } from "./IVGauge";
import { OptionsChain } from "./OptionsChain";
import { StrategyCards } from "./StrategyCards";
import { PayoffDiagram } from "./PayoffDiagram";
import { AISignalBox } from "./AISignalBox";
import { OptionsAIBox } from "./OptionsAIBox";
import { StrategyComparePanel } from "./StrategyComparePanel";
import { getRecommendedStrategyId } from "@/lib/strategies";
import { MetricCard } from "./MetricCard";
import StockPriceChart from "./StockPriceChart";
import { useIsMobile } from "@/hooks/useIsMobile";

interface StockDetailClientProps {
  ticker: string;
  spot: number;
  change: number;
  iv: IVStats;
  optionsChain: OptionsContract[];
  strategyCards: StrategyCard[];
  initialSignal?: AISignal | null;
}

export function StockDetailClient({
  ticker,
  spot,
  change,
  iv,
  optionsChain,
  strategyCards,
  initialSignal,
}: StockDetailClientProps) {
  const { isMobile } = useIsMobile();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    strategyCards[0]?.id ?? null
  );
  const selectedCard = strategyCards.find((c) => c.id === selectedStrategyId) ?? null;
  const [selectedContract, setSelectedContract] = useState<OptionsContract | null>(null);
  const recommendedId = getRecommendedStrategyId(iv.ivRank);
  const compareStrategies = [
    strategyCards.find((c) => c.id === selectedStrategyId),
    strategyCards.find((c) => c.id === recommendedId),
    strategyCards.find((c) => c.id !== selectedStrategyId && c.id !== recommendedId),
  ].filter(Boolean) as StrategyCard[];

  const pctChange = useMemo(() => (spot ? (change / spot) * 100 : 0), [change, spot]);
  const moodColor = iv.ivRank < 30 ? "#1D9E75" : iv.ivRank <= 50 ? "#BA7517" : "#D85A30";
  const moodLabel = iv.ivRank < 30 ? "波动偏低" : iv.ivRank <= 50 ? "波动中性" : "波动偏高";
  const earningsCountdown = useMemo(() => {
    if (!iv.nextEarnings) return null;
    const d = new Date(iv.nextEarnings);
    if (Number.isNaN(d.getTime())) return iv.nextEarnings;
    // mock 数据场景：开发环境固定 today，避免“今天日期变化导致 mock 倒计时乱跳”
    const today = process.env.NODE_ENV === "development" ? new Date("2026-03-18") : new Date();
    const diff = d.getTime() - today.getTime();
    const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (daysUntil > 0) return `距财报 ${daysUntil} 天`;
    if (daysUntil === 0) return "今天财报！";
    return `财报已过（${Math.abs(daysUntil)}天前）`;
  }, [iv.nextEarnings]);

  const tabs = [
    { id: "strategies", label: "策略情景" },
    { id: "chain", label: "衍生品链" },
    { id: "payoff", label: "收益图" },
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("strategies");

  return (
    <div className="space-y-4 px-3 pb-4 md:space-y-6 md:px-0 md:pb-0">
      {/* 1) 股票总结卡 */}
      <div
        className={`rounded-2xl border border-[color:var(--border-normal)] bg-[color:var(--bg-card)] shadow-[0_18px_48px_rgba(0,0,0,0.7)] ${isMobile ? "p-4" : "p-6"}`}
      >
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            {ticker} · 公开市场数据
          </div>
          <div
            className={`mt-2 ${isMobile ? "flex flex-col gap-2" : "flex items-baseline gap-3"}`}
          >
            <div
              className={`font-mono font-semibold text-[color:var(--text-primary)] ${isMobile ? "text-3xl" : "text-4xl"}`}
            >
              ${spot.toFixed(2)}
            </div>
            <div className={change >= 0 ? "text-[color:var(--color-up)]" : "text-[color:var(--color-down)]"}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)} ({pctChange >= 0 ? "+" : ""}
              {pctChange.toFixed(2)}%)
            </div>
          </div>
          <div className={`mt-3 grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-5"}`}>
            <MetricCard label="市场波动(30日)" value={`${(iv.iv30d * 100).toFixed(1)}%`} />
            <MetricCard label="波动分位示意" value={moodLabel} sub="仅作数据参考" className="border-white/10" />
            <MetricCard label="市场分位" value={iv.ivPercentile.toFixed(0)} sub="越低越平静" />
            <MetricCard label="下次财报" value={iv.nextEarnings ?? "—"} sub={earningsCountdown ? `倒计时：${earningsCountdown}` : undefined} />
            <MetricCard label="波动范围(52周)" value={`${(iv.iv52wLow * 100).toFixed(0)}-${(iv.iv52wHigh * 100).toFixed(0)}%`} />
          </div>
        </div>
      </div>

      {/* 1.5) 股价走势图（价格卡下方，AI 分析上方） */}
      <StockPriceChart
        ticker={ticker}
        currentPrice={spot}
        chartHeight={isMobile ? 200 : 300}
      />

      {/* 1.8) 市场数据解读 */}
      <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
        <AISignalBox
          ticker={ticker}
          initial={initialSignal}
          ctx={{
            price: spot,
            ivRank: iv.ivRank,
            iv30d: Number((iv.iv30d * 100).toFixed(1)),
            nextEarnings: iv.nextEarnings,
          }}
        />
      </div>

      {/* 2) 波动分位（IV Rank） */}
      <div className="grid gap-4 md:grid-cols-2">
        <IVGauge stats={iv} className="rounded-2xl" />
        <div className="rounded-2xl border border-white/10 bg-navy-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-white/60">市场情绪解释</div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>52周低</span>
              <span style={{ color: moodColor }}>{moodLabel}</span>
              <span>52周高</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-info" style={{ width: `${Math.min(100, Math.max(0, iv.ivRank))}%` }} />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            <div className="text-[10px] uppercase tracking-wide text-white/40">估值温度计结论</div>
            <div className="mt-1">
              {iv.ivRank < 30
                ? "隐含波动处于较低分位，反映市场对短期波动的定价相对温和，仅供数据观察。"
                : iv.ivRank <= 50
                  ? "隐含波动处于中等分位，市场定价分歧一般，仅供数据观察。"
                  : "隐含波动处于较高分位，短期不确定性定价偏高，仅供数据观察。"}
            </div>
            {iv.nextEarnings && (
              <div className="mt-2 text-xs text-white/60">
                下次财报：{iv.nextEarnings}（{earningsCountdown ? `倒计时 ${earningsCountdown}` : "—"}）
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3) Tabs */}
      <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "rounded-lg bg-info/20 px-3 py-1.5 text-xs font-medium text-info"
                  : "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "strategies" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-white">策略情景说明（教育用途，非操作指引）</div>
                <StrategyCards cards={strategyCards} ivRank={iv.ivRank} selectedId={selectedStrategyId} onSelect={setSelectedStrategyId} />
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-white">策略收益对比</div>
                <StrategyComparePanel strategies={compareStrategies} spot={spot} />
              </div>
            </div>
          )}

          {tab === "chain" && (
            <div>
              <details className="rounded-xl border border-white/10 bg-navy-card p-3">
                <summary className="cursor-pointer text-sm text-white/80">衍生品报价链（专业参考，点击展开）</summary>
                <p className="mt-2 text-xs text-white/50">
                  ATM 行蓝色高亮，ITM 行绿色。选择合约后可在下方生成合约级数据说明（不构成任何投资建议）。
                </p>
                <div className="mt-3">
                  <OptionsChain contracts={optionsChain} spot={spot} selected={selectedContract} onSelectContract={setSelectedContract} />
                </div>
                <div className="mt-3">
                  <OptionsAIBox ticker={ticker} spot={spot} ivRank={iv.ivRank} contract={selectedContract} />
                </div>
              </details>
            </div>
          )}

          {tab === "payoff" && (
            <div>
              <div className="mb-2 text-sm font-semibold text-white">收益图：{selectedCard?.name ?? "未选择"}</div>
              <PayoffDiagram strategy={selectedCard} spot={spot} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
