"use client";

import type { CSSProperties } from "react";

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
        "cursor-pointer select-none",
        borderLeft ? "border-l border-gray-700" : "",
        active ? "text-white" : "text-gray-500 hover:text-gray-300",
      ].join(" ")}
    >
      <span className="inline-flex w-full items-center justify-end gap-1">
        {label}
        <span className="inline-flex flex-col" style={{ gap: 1, lineHeight: 1 }}>
          <svg width={7} height={5} viewBox="0 0 7 5" aria-hidden>
            <path
              d="M3.5 0L7 5H0L3.5 0Z"
              fill={active && sortDir === "desc" ? "#fff" : "#4b5563"}
            />
          </svg>
          <svg width={7} height={5} viewBox="0 0 7 5" aria-hidden>
            <path
              d="M3.5 5L0 0H7L3.5 5Z"
              fill={active && sortDir === "asc" ? "#fff" : "#4b5563"}
            />
          </svg>
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
