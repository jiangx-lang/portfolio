"use client";

import {
  AreaChart,
  Area,
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

/** 深色玻璃 tooltip：金边 + font-mono 数值 */
function NavChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const num = typeof raw === "number" ? raw : Number(raw);
  return (
    <div className="rounded-xl border border-gold/30 bg-navy-elevated/95 px-3 py-2 shadow-card backdrop-blur-md">
      <p className="font-mono text-[11px] text-slate-500">日期 {label}</p>
      <p className="mt-1 font-mono text-sm text-gold-light">
        净值 {Number.isFinite(num) ? num.toFixed(4) : "—"}
      </p>
    </div>
  );
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
        className="glass-card flex flex-col text-slate-500"
        style={{ minHeight: height }}
      >
        {showRangeBar && (
          <div className="border-b border-white/[0.07] p-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/[0.07] bg-navy/60 p-1">
              {NAV_CHART_RANGES.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  disabled
                  className="rounded-full border border-transparent px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">暂无净值数据</div>
      </div>
    );
  }

  return (
    <div
      className="glass-card p-4"
      style={{ minHeight: height }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-300">
          历史净值 {isin ? <span className="font-mono text-slate-500">· {isin}</span> : ""}
        </p>
        {rangeLoading && (
          <span className="text-xs text-gold-light/90" aria-live="polite">
            更新中…
          </span>
        )}
      </div>

      {showRangeBar && (
        <div className="mb-3 inline-flex flex-wrap items-center gap-1 rounded-full border border-white/[0.07] bg-navy/60 p-1">
          {NAV_CHART_RANGES.map((r) => {
            const active = r.days === rangeDays;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => onRangeChange!(r.days)}
                disabled={rangeLoading}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border border-gold/40 bg-gold/15 text-gold-light"
                    : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                } ${rangeLoading ? "cursor-wait opacity-70" : ""}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {data.length === 0 && rangeLoading ? (
        <div className="flex items-center justify-center text-slate-500" style={{ height: height * 0.75 }}>
          加载图表…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={showRangeBar ? Math.max(200, height - 72) : height * 0.9}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="atlasNavStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#9A7E2F" />
                <stop offset="55%" stopColor="#C9A84C" />
                <stop offset="100%" stopColor="#E3C87A" />
              </linearGradient>
              <linearGradient id="atlasNavFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#C9A84C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,194,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#64748b", className: "font-mono" }}
              tickFormatter={(v) => (v ? String(v).slice(5) : "")}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b", className: "font-mono" }}
              tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : "")}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<NavChartTooltip />} />
            <Area
              type="monotone"
              dataKey="nav"
              stroke="url(#atlasNavStroke)"
              strokeWidth={2}
              fill="url(#atlasNavFill)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
