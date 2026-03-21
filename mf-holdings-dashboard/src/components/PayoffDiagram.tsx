"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { StrategyCard } from "@/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PayoffDiagramProps {
  strategy: StrategyCard | null;
  spot: number;
}

export function PayoffDiagram({ strategy, spot }: PayoffDiagramProps) {
  if (!strategy) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-white/10 bg-navy-card text-white/50">
        Select a strategy
      </div>
    );
  }

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
    } else {
      // 低于盈亏平衡点 = 亏损（负值）；高于盈亏平衡点 = 盈利（正值）
      pl = p <= strategy.breakeven ? -Math.abs(strategy.maxLoss) : Math.abs(strategy.maxProfit);
    }
    profits.push(pl);
  }

  const data = {
    labels: labels.map(String),
    datasets: [
      {
        label: "P&L ($)",
        data: profits,
        backgroundColor: profits.map((v) => (v >= 0 ? "rgba(29, 158, 117, 0.8)" : "rgba(216, 90, 48, 0.8)")),
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: `${strategy.name} payoff`, color: "#9CA3AF" },
    },
    scales: {
      x: {
        ticks: { color: "#9CA3AF", maxTicksLimit: 12 },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      y: {
        reverse: false,
        ticks: { color: "#9CA3AF" },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
    },
  };

  return (
    <div className="h-[240px] rounded-xl border border-white/10 bg-navy-card p-4">
      <Bar data={data} options={options} />
    </div>
  );
}
