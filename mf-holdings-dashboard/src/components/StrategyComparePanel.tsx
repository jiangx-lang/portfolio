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

const COLORS = ["rgba(24,95,165,0.9)", "rgba(29,158,117,0.9)", "rgba(216,90,48,0.9)"];

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
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-white/10 bg-navy-card text-white/50">
        No strategies to compare
      </div>
    );
  }

  const base = buildPayoffSeries(usable[0], spot);
  const datasets = usable.map((s, idx) => {
    const series = buildPayoffSeries(s, spot);
    return {
      label: s.name,
      data: series.profits,
      borderColor: COLORS[idx] ?? COLORS[0],
      backgroundColor: (COLORS[idx] ?? COLORS[0]).replace("0.9", "0.15"),
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
      legend: { labels: { color: "#9CA3AF", boxWidth: 10, boxHeight: 10 } },
      title: { display: true, text: "Strategy payoff compare", color: "#9CA3AF" },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { color: "#9CA3AF", maxTicksLimit: 10 }, grid: { color: "rgba(255,255,255,0.06)" } },
      y: { ticks: { color: "#9CA3AF" }, grid: { color: "rgba(255,255,255,0.06)" } },
    },
  } as const;

  return (
    <div className="h-[260px] rounded-xl border border-white/10 bg-navy-card p-4">
      <Line data={data} options={options} />
    </div>
  );
}

