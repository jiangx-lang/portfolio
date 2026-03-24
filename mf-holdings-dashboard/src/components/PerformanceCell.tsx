"use client";

interface PerformanceCellProps {
  value: number | null | undefined;
  digits?: number;
}

/**
 * 基金列表绩效单元格：百分比已按「数值 = 百分点」存储（如 0.32 → +0.32%）
 */
export function PerformanceCell({ value, digits = 2 }: PerformanceCellProps) {
  if (value == null || (typeof value === "number" && Number.isNaN(value))) {
    return (
      <span className="block text-right text-xs font-medium tabular-nums text-gray-500">—</span>
    );
  }
  const n = Number(value);
  if (n === 0) {
    return (
      <span className="block text-right text-xs font-medium tabular-nums text-gray-400">0.00%</span>
    );
  }
  const abs = Math.abs(n).toFixed(digits);
  const text = n > 0 ? `+${abs}%` : `-${abs}%`;
  const color = n > 0 ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`block text-right text-xs font-medium tabular-nums ${color}`}>{text}</span>
  );
}
