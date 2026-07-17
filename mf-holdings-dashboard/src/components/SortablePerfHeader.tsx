"use client";

import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type PerfKey =
  | "daily_return"
  | "weekly_return"
  | "monthly_1"
  | "monthly_3"
  | "monthly_6"
  | "yearly_1";

export interface SortablePerfHeaderProps {
  label: string;
  perfKey: PerfKey;
  sortKey: PerfKey | null;
  sortDir: "desc" | "asc";
  onSort: (key: PerfKey) => void;
  borderLeft?: boolean;
  minWidth?: number;
  style?: CSSProperties;
}

export function SortablePerfHeader({
  label,
  perfKey,
  sortKey,
  sortDir,
  onSort,
  borderLeft,
  minWidth,
  style,
}: SortablePerfHeaderProps) {
  const active = sortKey === perfKey;
  return (
    <th
      scope="col"
      onClick={(e) => {
        e.stopPropagation();
        onSort(perfKey);
      }}
      style={{ ...style, ...(minWidth != null ? { minWidth } : {}) }}
      className={[
        "text-right text-xs font-medium whitespace-nowrap px-3 py-2",
        "cursor-pointer select-none transition-colors",
        borderLeft ? "border-l border-white/[0.07]" : "",
        active ? "text-gold" : "text-slate-500 hover:text-slate-300",
      ].join(" ")}
    >
      <span className="inline-flex w-full items-center justify-end gap-1">
        {label}
        <span className="inline-flex flex-col items-center leading-none -space-y-1.5">
          <ChevronUp
            size={10}
            strokeWidth={2.5}
            aria-hidden
            className={active && sortDir === "desc" ? "text-gold" : "text-slate-600"}
          />
          <ChevronDown
            size={10}
            strokeWidth={2.5}
            aria-hidden
            className={active && sortDir === "asc" ? "text-gold" : "text-slate-600"}
          />
        </span>
      </span>
    </th>
  );
}

/** 用于排序：无效数值视为 null，与缺失一并排在最后 */
export function perfSortValue(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
