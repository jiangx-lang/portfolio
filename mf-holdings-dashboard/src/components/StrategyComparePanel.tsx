"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { StrategyCard } from "@/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

function buildPayoffSeries(strategy: StrategyCard, spot: number) {
  const labels: number[] = [];
  const profits: number[] = [];
  const step = Math.max(5, Math.round(spot * 0.02));
  for (let p = spot - step * 10; p <= spot + step * 10; p += step) {
    labels.push(p);
    let pl = 0;
    if (strategy.id === "bull_call_spread" && strategy.strikes?.buy != null && strategy.strikes?.sell != null) {
      const buy = strategy.strikes.buy;
      const sell = strategy.strikes.sell;
      const width = sell - buy;
      if (p <= buy) pl = -strategy.maxLoss;
      else if (p >= sell) pl = width * 100 - strategy.maxLoss;
      else pl = (p - buy) * 100 - strategy.maxLoss;
    } else if (strategy.id === "cash_secured_put" && strategy.strikes?.sell != null) {
      const k = strategy.strikes.sell;
      const prem = strategy.maxProfit / 100;
      if (p >= k) pl = strategy.maxProfit;
      else pl = (p - k) * 100 + prem * 100;
    } else if (strategy.maxProfit === Number.POSITIVE_INFINITY && strategy.strikes?.buy != null) {
      // LEAP / long option style: approximate as (S-K)*100 - debit
      const k = strategy.strikes.buy;
      if (p <= k) pl = -strategy.maxLoss;
      else pl = (p - k) * 100 - strategy.maxLoss;
    } else {
      pl = p <= strategy.breakeven ? -strategy.maxLoss : strategy.maxProfit;
    }
    profits.push(pl);
  }
  return { labels: labels.map(String), profits };
}

const LINE_PALETTE = [
  { border: "rgba(201,168,76,0.95)", fill: "rgba(201,168,76,0.12)" },
  { border: "rgba(91,147,240,0.9)", fill: "rgba(91,147,240,0.12)" },
  { border: "rgba(148,163,194,0.8)", fill: "rgba(148,163,194,0.1)" },
];

export function StrategyComparePanel({
  strategies,
  spot,
}: {
  strategies: StrategyCard[];
  spot: number;
}) {
  const usable = strategies.filter(Boolean).slice(0, 3);
  if (usable.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/[0.07] bg-navy-card text-slate-500">
        暂无可对比的策略
      </div>
    );
  }

  const base = buildPayoffSeries(usable[0], spot);
  const datasets = usable.map((s, idx) => {
    const series = buildPayoffSeries(s, spot);
    const palette = LINE_PALETTE[idx] ?? LINE_PALETTE[0];
    return {
      label: s.name,
      data: series.profits,
      borderColor: palette.border,
      backgroundColor: palette.fill,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
    };
  });

  const data = {
    labels: base.labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#9AA7BD", boxWidth: 10, boxHeight: 10 } },
      title: { display: true, text: "策略收益曲线对比", color: "#E3C87A" },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(12,17,32,0.95)",
        borderColor: "rgba(201,168,76,0.3)",
        borderWidth: 1,
        titleColor: "#E3C87A",
        bodyColor: "#F4F6FB",
        padding: 10,
        cornerRadius: 10,
      },
    },
    scales: {
      x: { ticks: { color: "#66738C", maxTicksLimit: 10 }, grid: { color: "rgba(148,163,194,0.08)" } },
      y: { ticks: { color: "#66738C" }, grid: { color: "rgba(148,163,194,0.08)" } },
    },
  } as const;

  return (
    <div className="h-[260px] rounded-2xl border border-white/[0.07] bg-navy-card p-4">
      <Line data={data} options={options} />
    </div>
  );
}

