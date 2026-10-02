"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { STRATEGY, cellOf, num, pct, type GridCell } from "@/data/publicStrategy";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const MAX_SELECTED = 4;
const PALETTE = ["#10B981", "#5B93F0", "#E85D50", "#C9A84C"];

export function VariantGrid() {
  const { ns, ws, weightLabels, holdingLabels, dates, nav, cells } =
    STRATEGY.grid;
  const [selected, setSelected] = useState<string[]>([
    STRATEGY.active.gridKey,
    STRATEGY.candidate.gridKey,
  ]);

  const cagrExtent = useMemo(() => {
    const vals = cells.map((c) => c.cagr);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [cells]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return prev.length >= MAX_SELECTED
        ? [...prev.slice(1), key]
        : [...prev, key];
    });

  const selectedCells = selected
    .map((k) => cells.find((c) => c.key === k))
    .filter((c): c is GridCell => Boolean(c));

  const chartData = useMemo(
    () => ({
      labels: dates,
      datasets: selectedCells.map((c, i) => ({
        label: `${c.holdingLabel} · ${c.weightLabel}`,
        data: nav[c.key],
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length],
        borderWidth: 1.8,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0,
      })),
    }),
    [dates, nav, selectedCells]
  );

  return (
    <div className="space-y-5">
      {/* 5×5 变体网格 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[11px] font-medium text-slate-500">
                持仓只数 \ 线下档位
              </th>
              {ws.map((w) => (
                <th
                  key={w}
                  className="px-1 py-1 text-center text-[11px] font-medium leading-tight text-slate-400"
                >
                  {weightLabels[String(w)]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ns.map((n) => (
              <tr key={n}>
                <th className="px-2 py-1 text-left text-[11px] font-medium text-slate-400">
                  {holdingLabels[String(n)]}
                </th>
                {ws.map((w) => {
                  const c = cellOf(n, w);
                  const t =
                    (c.cagr - cagrExtent.min) /
                    (cagrExtent.max - cagrExtent.min || 1);
                  const isSel = selected.includes(c.key);
                  const isActive = c.key === STRATEGY.active.gridKey;
                  return (
                    <td key={w}>
                      <motion.button
                        type="button"
                        onClick={() => toggle(c.key)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className={`num w-full rounded-lg px-1 py-2 text-center text-[12px] transition-shadow sm:text-[13px] ${
                          isSel
                            ? "ring-2 ring-emerald-400 text-white shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                            : "text-slate-200 hover:shadow-[0_0_16px_rgba(16,185,129,0.35)] hover:ring-1 hover:ring-emerald-300/50"
                        }`}
                        style={{
                          backgroundColor: `rgba(16,185,129,${(
                            0.06 +
                            t * 0.42
                          ).toFixed(3)})`,
                        }}
                        title={`${c.holdingLabel} · ${c.weightLabel}`}
                      >
                        {pct(c.cagr, 1)}
                        {isActive && (
                          <span className="mt-0.5 block text-[9px] font-semibold text-emerald-200">
                            现役
                          </span>
                        )}
                      </motion.button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        单元格为年化收益率（颜色越亮越高）。点击格子联动下方曲线与指标，最多同时对比{" "}
        {MAX_SELECTED} 个变体。
      </p>

      {/* 联动净值曲线 */}
      <div className="h-[240px] sm:h-[300px]">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
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
                grid: { color: "rgba(148,163,194,0.08)" },
                ticks: {
                  color: "#7c88a5",
                  font: { size: 10 },
                  autoSkip: true,
                  maxTicksLimit: 12,
                  maxRotation: 0,
                },
              },
              y: {
                type: "logarithmic",
                title: {
                  display: true,
                  text: "净值（对数轴，起点=1）",
                  color: "#7c88a5",
                  font: { size: 10 },
                },
                grid: { color: "rgba(148,163,194,0.08)" },
                ticks: { color: "#7c88a5", font: { size: 10 } },
              },
            },
          }}
        />
      </div>

      {/* 联动指标表 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-[11px] text-slate-500">
              <th className="py-2 pr-3 font-medium">变体</th>
              <th className="py-2 pr-3 text-right font-medium">年化收益</th>
              <th className="py-2 pr-3 text-right font-medium">夏普比率</th>
              <th className="py-2 pr-3 text-right font-medium">最大回撤</th>
              <th className="py-2 pr-3 text-right font-medium">收益回撤比</th>
              <th className="py-2 text-right font-medium">累计倍数</th>
            </tr>
          </thead>
          <tbody>
            {selectedCells.map((c, i) => (
              <tr
                key={c.key}
                className="border-b border-white/[0.05] text-slate-200"
              >
                <td className="py-2 pr-3">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  {c.holdingLabel} · {c.weightLabel}
                  {c.key === STRATEGY.active.gridKey && (
                    <span className="ml-2 rounded border border-emerald-500/40 px-1 text-[10px] text-emerald-400">
                      现役
                    </span>
                  )}
                </td>
                <td className="num py-2 pr-3 text-right">{pct(c.cagr, 1)}</td>
                <td className="num py-2 pr-3 text-right">{num(c.sharpe)}</td>
                <td className="num py-2 pr-3 text-right text-rise">
                  {pct(c.maxDD, 1)}
                </td>
                <td className="num py-2 pr-3 text-right">{num(c.calmar)}</td>
                <td className="num py-2 text-right">{num(c.multiple, 1)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
