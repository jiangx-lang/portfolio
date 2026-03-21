"use client";

import type { StrategyCard } from "@/types";
import { cn } from "@/lib/utils";
import { getRecommendedStrategyId } from "@/lib/strategies";

interface StrategyCardsProps {
  cards: StrategyCard[];
  ivRank: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StrategyCards({
  cards,
  ivRank,
  selectedId,
  onSelect,
}: StrategyCardsProps) {
  const recommendedId = getRecommendedStrategyId(ivRank);
  const zh = (id: string) => {
    const map: Record<string, { name: string; tag: string; suitable: string; oneLiner: string }> = {
      bull_call_spread: {
        name: "牛市价差（Bull Call Spread）",
        tag: "Debit",
        suitable: "适合：看好后市、想控制成本的投资者",
        oneLiner: "用较小成本参与上涨，收益上限明确。",
      },
      leap_call: {
        name: "长期看涨期权（LEAP Call）",
        tag: "Debit",
        suitable: "适合：长期看好、愿意承担时间价值波动的投资者",
        oneLiner: "用权利金锁定未来上涨权利，杠杆更高。",
      },
      cash_secured_put: {
        name: "现金担保卖出Put（CSP）",
        tag: "Credit",
        suitable: "适合：愿意更低价接货、偏稳健的投资者",
        oneLiner: "收取权利金，若回调则以更低成本买入。",
      },
      covered_call: {
        name: "备兑开仓（Covered Call）",
        tag: "Hedge",
        suitable: "适合：已持有正股、希望增强收益的投资者",
        oneLiner: "卖出看涨期权增厚收益，但上涨收益受限。",
      },
      put_debit_spread: {
        name: "看跌价差（Put Debit Spread）",
        tag: "Hedge",
        suitable: "适合：短期对冲回撤风险的投资者",
        oneLiner: "用有限成本对冲下跌，最大亏损可控。",
      },
      diagonal: {
        name: "对角价差（Diagonal）",
        tag: "Neutral",
        suitable: "适合：中性偏多、希望滚动收租的投资者",
        oneLiner: "长短期组合，平衡成本与时间价值。",
      },
    };
    return map[id] || { name: id, tag: "—", suitable: "—", oneLiner: "" };
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const isRec = card.id === recommendedId;
        const isSel = card.id === selectedId;
        const meta = zh(card.id);
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelect(card.id)}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              "border-white/10 bg-[#0a0e1a] hover:border-white/20",
              isSel && "ring-2 ring-info",
              isRec && "border-amber-500/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">{meta.name}</span>
              {isRec && (
                <span className="rounded bg-info/20 px-1.5 py-0.5 text-xs text-info">推荐</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/70">{meta.tag}</span>
              <span className="text-xs text-white/50">{meta.suitable}</span>
            </div>
            {meta.oneLiner && <div className="mt-2 text-xs text-white/60">{meta.oneLiner}</div>}
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <span className="text-white/50">最大收益</span>
              <span className="font-mono text-gain">
                {card.maxProfit === Infinity ? "∞" : `$${card.maxProfit.toFixed(0)}`}
              </span>
              <span className="text-white/50">最大亏损</span>
              <span className="font-mono text-loss">${card.maxLoss.toFixed(0)}</span>
              <span className="text-white/50">盈亏平衡</span>
              <span className="font-mono text-white">{card.breakeven.toFixed(2)}</span>
              <span className="text-white/50">胜率(估)</span>
              <span className="font-mono text-white">{(card.probabilityOfProfit * 100).toFixed(0)}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
