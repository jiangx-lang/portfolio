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
    <div className={cn("rounded-xl border border-white/10 bg-navy-card p-4", className)}>
      <p className="mb-2 text-sm font-medium text-white/80">市场情绪温度计（越平静越适合布局）</p>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-info transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-white/60">
        <span>更平静</span>
        <span className="text-white/80">{level}</span>
        <span>更紧张</span>
      </div>
      <p className="mt-2 text-sm text-white/70">
        市场波动（30日）：{(stats.iv30d * 100).toFixed(1)}% · 市场分位：{stats.ivPercentile.toFixed(0)}
      </p>
      {stats.nextEarnings && (
        <p className="mt-1 text-xs text-white/50">下次财报：{stats.nextEarnings}</p>
      )}
    </div>
  );
}
