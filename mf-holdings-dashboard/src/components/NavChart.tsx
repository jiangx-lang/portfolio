"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/** 净值曲线时间范围（days=0 表示 API 不截断日期，由服务端 limit） */
export const NAV_CHART_RANGES = [
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
  { label: "5Y", days: 1825 },
  { label: "全部", days: 0 },
] as const;

interface NavChartProps {
  dates: string[];
  navs: number[];
  isin?: string;
  height?: number;
  /** 当前选中的天数（与 NAV_CHART_RANGES 中某项一致，默认 365） */
  rangeDays?: number;
  /** 切换范围时由父组件带 ?days= 重新请求 /api/nav */
  onRangeChange?: (days: number) => void;
  /** 正在拉取当前范围下的净值 */
  rangeLoading?: boolean;
}

export function NavChart({
  dates,
  navs,
  isin,
  height = 320,
  rangeDays = 365,
  onRangeChange,
  rangeLoading = false,
}: NavChartProps) {
  const data = dates.map((d, i) => ({ date: d, nav: navs[i] ?? 0 }));

  const showRangeBar = typeof onRangeChange === "function";

  if (!data.length && !rangeLoading) {
    return (
      <div
        className="flex flex-col rounded-xl border border-white/10 bg-navy-card text-white/50"
        style={{ minHeight: height }}
      >
        {showRangeBar && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
            {NAV_CHART_RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                disabled
                className="rounded-md px-2.5 py-1 text-xs text-white/40"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">暂无净值数据</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-white/10 bg-navy-card p-4"
      style={{ minHeight: height }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/80">
          历史净值 {isin ? `· ${isin}` : ""}
        </p>
        {rangeLoading && (
          <span className="text-xs text-sky-400/90" aria-live="polite">
            更新中…
          </span>
        )}
      </div>

      {showRangeBar && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {NAV_CHART_RANGES.map((r) => {
            const active = r.days === rangeDays;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => onRangeChange!(r.days)}
                disabled={rangeLoading}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border border-sky-500/80 bg-sky-500/20 text-sky-300"
                    : "border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                } ${rangeLoading ? "cursor-wait opacity-70" : ""}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {data.length === 0 && rangeLoading ? (
        <div className="flex items-center justify-center text-white/50" style={{ height: height * 0.75 }}>
          加载图表…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={showRangeBar ? Math.max(200, height - 72) : height * 0.9}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickFormatter={(v) => (v ? String(v).slice(5) : "")}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : "")}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(value: number) => [value.toFixed(4), "净值"]}
              labelFormatter={(label) => `日期: ${label}`}
            />
            <Line type="monotone" dataKey="nav" stroke="#185FA5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
