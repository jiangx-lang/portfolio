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
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-white/[0.07] bg-navy-card text-slate-500">
        请选择策略情景
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
        // 红涨绿跌：正收益为红、负收益为绿
        backgroundColor: profits.map((v) => (v >= 0 ? "rgba(232,93,80,0.85)" : "rgba(47,191,143,0.85)")),
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: `${strategy.name} 收益结构`, color: "#E3C87A" },
      tooltip: {
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
      x: {
        ticks: { color: "#66738C", maxTicksLimit: 12 },
        grid: { color: "rgba(148,163,194,0.08)" },
      },
      y: {
        reverse: false,
        ticks: { color: "#66738C" },
        grid: { color: "rgba(148,163,194,0.08)" },
      },
    },
  };

  return (
    <div className="h-[240px] rounded-2xl border border-white/[0.07] bg-navy-card p-4">
      <Bar data={data} options={options} />
    </div>
  );
}
