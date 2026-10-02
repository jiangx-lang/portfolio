"use client";

import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { STRATEGY } from "@/data/publicStrategy";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

const GRID = "rgba(148,163,194,0.08)";
const TICK = { color: "#7c88a5", font: { size: 10 } };

function baseOptions(yTitle: string, log = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        labels: { color: "#aab4cc", boxWidth: 14, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: "#0C1120",
        borderColor: "rgba(201,168,76,0.35)",
        borderWidth: 1,
        titleColor: "#E3C87A",
        bodyColor: "#cbd5e1",
      },
    },
    scales: {
      x: {
        grid: { color: GRID },
        ticks: { ...TICK, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 },
      },
      y: {
        type: log ? ("logarithmic" as const) : ("linear" as const),
        title: { display: true, text: yTitle, color: "#7c88a5", font: { size: 10 } },
        grid: { color: GRID },
        ticks: TICK,
      },
    },
  };
}

const line = (
  label: string,
  data: (number | null)[],
  color: string,
  width = 2,
  dash?: number[]
) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: color,
  borderWidth: width,
  borderDash: dash,
  pointRadius: 0,
  pointHoverRadius: 3,
  tension: 0,
  spanGaps: true,
});

export function StrategyNavChart() {
  const mc = STRATEGY.mainChart;

  const navData = useMemo(
    () => ({
      labels: mc.dates,
      datasets: [
        line(STRATEGY.active.label, mc.active, "#10B981", 2.2),
        line("全市场等权基准", mc.benchmark, "#94A3C2", 1.4),
        line(STRATEGY.candidate.label, mc.candidate, "#5B93F0", 1.4, [5, 4]),
      ],
    }),
    [mc]
  );

  const ddData = useMemo(
    () => ({
      labels: mc.dates,
      datasets: [
        { ...line(STRATEGY.active.label, mc.ddActive, "#10B981", 1.6), fill: true, backgroundColor: "rgba(16,185,129,0.10)" },
        { ...line("全市场等权基准", mc.ddBenchmark, "#94A3C2", 1.2), fill: true, backgroundColor: "rgba(148,163,194,0.08)" },
      ],
    }),
    [mc]
  );

  return (
    <div className="space-y-4">
      <div className="h-[300px] sm:h-[380px]">
        <Line data={navData} options={baseOptions("净值（对数轴，起点=1）", true)} />
      </div>
      <div className="h-[140px] sm:h-[170px]">
        <Line data={ddData} options={baseOptions("回撤")} />
      </div>
    </div>
  );
}
