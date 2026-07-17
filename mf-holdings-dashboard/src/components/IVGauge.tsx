"use client";

import type { IVStats } from "@/types";
import { cn } from "@/lib/utils";

interface IVGaugeProps {
  stats: IVStats;
  className?: string;
}

export function IVGauge({ stats, className }: IVGaugeProps) {
  const pct = Math.min(100, Math.max(0, stats.ivRank));
  const level =
    stats.ivRank < 30 ? "市场平静（更适合布局）" : stats.ivRank < 50 ? "市场中性（可分批）" : "市场紧张（谨慎）";
  return (
    <div className={cn("rounded-2xl border border-white/[0.07] bg-navy-card p-5", className)}>
      <p className="mb-3 text-sm font-medium text-slate-300">市场情绪温度计（越平静越适合布局）</p>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-500">
        <span>更平静</span>
        <span className="font-sans text-slate-200">{level}</span>
        <span>更紧张</span>
      </div>
      <p className="mt-3 text-sm text-slate-400">
        市场波动（30日）：<span className="font-mono text-slate-200">{(stats.iv30d * 100).toFixed(1)}%</span>
        {" · "}市场分位：<span className="font-mono text-slate-200">{stats.ivPercentile.toFixed(0)}</span>
      </p>
      {stats.nextEarnings && (
        <p className="mt-1 text-xs text-slate-500">
          下次财报：<span className="font-mono">{stats.nextEarnings}</span>
        </p>
      )}
    </div>
  );
}
