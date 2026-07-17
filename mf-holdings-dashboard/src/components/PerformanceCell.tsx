"use client";

interface PerformanceCellProps {
  value: number | null | undefined;
  digits?: number;
}

/** 绩效表「净值日期」列：YYYY-MM-DD */
export function formatPerfNavDate(navDate: string | null | undefined): string | null {
  if (navDate == null || String(navDate).trim() === "") return null;
  const s = String(navDate).trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/** 列表「NAV」列展示 */
export function formatFundNavDisplay(nav: number | null | undefined): string {
  if (nav == null || (typeof nav === "number" && Number.isNaN(nav))) return "—";
  const n = Number(nav);
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/**
 * 基金列表绩效单元格：百分比已按「数值 = 百分点」存储（如 0.32 → +0.32%）
 */
export function PerformanceCell({ value, digits = 2 }: PerformanceCellProps) {
  if (value == null || (typeof value === "number" && Number.isNaN(value))) {
    return (
      <span className="block text-right text-xs font-medium font-mono text-flat">—</span>
    );
  }
  const n = Number(value);
  if (n === 0) {
    return (
      <span className="block text-right text-xs font-medium font-mono text-flat">0.00%</span>
    );
  }
  const abs = Math.abs(n).toFixed(digits);
  const text = n > 0 ? `+${abs}%` : `-${abs}%`;
  // 中国市场惯例：红涨绿跌
  const color = n > 0 ? "text-rise" : "text-fall";
  return (
    <span className={`block text-right text-xs font-medium font-mono ${color}`}>{text}</span>
  );
}
