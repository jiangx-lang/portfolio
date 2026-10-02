"use client";

import { useMemo } from "react";
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
import {
  AlertTriangle,
  Crosshair,
  Crown,
  LogOut,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { STRATEGY, num, pct } from "@/data/publicStrategy";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const LINE_STYLE: Record<string, { color: string; width: number; dash?: number[] }> = {
  h3: { color: "#475569", width: 1.1 },
  h5: { color: "#7c88a5", width: 1.1 },
  h10: { color: "#10B981", width: 2.4 },
  h15: { color: "#5B93F0", width: 1.1 },
  h20: { color: "#a5b4d4", width: 1.1 },
  v0: { color: "#E85D50", width: 1.2, dash: [4, 4] },
};

const MECH_ICONS = [Crosshair, ShieldCheck, LogOut, TrendingDown];

export function V16SwitchSection() {
  const v = STRATEGY.v16;
  const prodLabel = `持仓${v.productionN}只`;

  const chartData = useMemo(
    () => ({
      labels: v.dates,
      datasets: ["h3", "h5", "h10", "h15", "h20", "v0"].map((k) => {
        const s = LINE_STYLE[k];
        const g = v.gradient.find((r) => `h${r.n}` === k);
        return {
          label: k === "v0" ? v.v0.label : g?.production ? `${g.holdingLabel} · 生产` : g?.holdingLabel ?? k,
          data: v.nav[k],
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: s.width,
          borderDash: s.dash,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0,
        };
      }),
    }),
    [v]
  );

  return (
    <div className="space-y-8">
      {/* 当前状态提示 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45 }}
        className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.7} />
        <div>
          <div className="text-sm font-semibold text-amber-300">
            当前开关状态：{v.state.status}
          </div>
          <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
            {v.state.text}
          </div>
        </div>
      </motion.div>

      {/* 三榜冠军卡 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {v.champions.map((c, i) => {
          const isProd = c.holdingLabel === prodLabel;
          return (
            <motion.div
              key={c.board}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className={`glass-panel p-5 transition-shadow ${
                isProd
                  ? "border-emerald-500/40 shadow-[0_0_28px_rgba(16,185,129,0.18)]"
                  : "hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]"
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <Crown
                  className={`h-3.5 w-3.5 ${isProd ? "text-emerald-400" : "text-gold"}`}
                  strokeWidth={1.8}
                />
                {c.board}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-100">
                  {c.holdingLabel}
                </span>
                {isProd && (
                  <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    生产版本
                  </span>
                )}
              </div>
              <div className="num mt-1 text-3xl font-bold text-emerald-300">
                {c.fmt === "pct" ? pct(c.value, 1) : num(c.value)}
              </div>
              {c.note && (
                <div className="mt-1 text-[11px] text-slate-500">{c.note}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* V1×N 梯度表 */}
      <div className="glass-panel overflow-x-auto p-3 sm:p-5">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-[11px] text-slate-500">
              <th className="py-2 pr-3 font-medium">档位</th>
              <th className="py-2 pr-3 text-right font-medium">年化收益</th>
              <th className="py-2 pr-3 text-right font-medium">夏普比率</th>
              <th className="py-2 pr-3 text-right font-medium">最大回撤</th>
              <th className="py-2 pr-3 text-right font-medium">收益回撤比</th>
              <th className="py-2 pr-3 text-right font-medium">累计倍数</th>
              <th className="py-2 text-right font-medium">开关交易笔数</th>
            </tr>
          </thead>
          <tbody>
            {v.gradient.map((r) => (
              <tr
                key={r.n}
                className={`border-b border-white/[0.05] ${
                  r.production
                    ? "bg-emerald-500/[0.07] text-emerald-200"
                    : "text-slate-300"
                }`}
              >
                <td className="py-2.5 pr-3 font-semibold">
                  {r.holdingLabel}
                  {r.production && (
                    <span className="ml-2 rounded border border-emerald-500/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      生产
                    </span>
                  )}
                </td>
                <td className="num py-2.5 pr-3 text-right">{pct(r.cagr, 1)}</td>
                <td className="num py-2.5 pr-3 text-right">{num(r.sharpe)}</td>
                <td className="num py-2.5 pr-3 text-right text-rise">
                  {pct(r.maxDD, 1)}
                </td>
                <td className="num py-2.5 pr-3 text-right">{num(r.calmar)}</td>
                <td className="num py-2.5 pr-3 text-right">
                  {num(r.multiple, 1)}×
                </td>
                <td className="num py-2.5 text-right text-slate-400">
                  {r.nTrades}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          同一池年线开关、仅持仓只数不同。收益对档位不敏感，回撤控制与夏普
          随分散度改善；生产版本取攻守兼备（收益回撤比）最优档。
        </p>
      </div>

      {/* 五档曲线 + V0 对照 */}
      <div className="glass-panel p-3 sm:p-5">
        <div className="h-[260px] sm:h-[340px]">
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
                  borderColor: "rgba(16,185,129,0.35)",
                  borderWidth: 1,
                  titleColor: "#6EE7B7",
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
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          绿色粗线为生产版本；红色虚线为旧版开关对照（同一信号引擎、持仓
          20 只口径）。新开关全档位的收益与夏普全面压过旧开关。
        </p>
      </div>

      {/* 机制四要点 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {v.mechanics.map((m, i) => {
          const Icon = MECH_ICONS[i % MECH_ICONS.length];
          return (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]"
            >
              <Icon className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                {m.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {m.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
