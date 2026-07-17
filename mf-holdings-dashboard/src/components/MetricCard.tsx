"use client";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function MetricCard({ label, value, sub, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.07] bg-navy-card p-4 text-left shadow-card",
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-slate-100">
        {value}
      </p>
      {sub != null && (
        <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
      )}
    </div>
  );
}
