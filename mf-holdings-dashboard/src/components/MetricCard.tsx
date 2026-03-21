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
        "rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.6)]",
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-[color:var(--text-primary)]">
        {value}
      </p>
      {sub != null && (
        <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{sub}</p>
      )}
    </div>
  );
}
