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

interface NavChartProps {
  dates: string[];
  navs: number[];
  isin?: string;
  height?: number;
}

export function NavChart({ dates, navs, isin, height = 320 }: NavChartProps) {
  const data = dates.map((d, i) => ({ date: d, nav: navs[i] ?? 0 }));

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/10 bg-navy-card text-white/50"
        style={{ height }}
      >
        暂无净值数据
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-white/10 bg-navy-card p-4"
      style={{ height }}
    >
      <p className="mb-2 text-sm font-medium text-white/80">
        历史净值 {isin ? `· ${isin}` : ""}
      </p>
      <ResponsiveContainer width="100%" height="90%">
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
          <Line
            type="monotone"
            dataKey="nav"
            stroke="#185FA5"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
