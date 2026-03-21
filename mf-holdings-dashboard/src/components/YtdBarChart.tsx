"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import type { Holding } from "@/types";

interface YtdBarChartProps {
  holdings: Holding[];
}

export function YtdBarChart({ holdings }: YtdBarChartProps) {
  const data = holdings.map((h) => ({
    ticker: h.ticker,
    ytd: h.ytd,
    fill: h.ytd >= 0 ? "var(--color-up)" : "var(--color-down)",
  }));

  return (
    <div className="h-[280px] w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.6)]">
      <p className="mb-2 text-sm font-medium text-[color:var(--text-secondary)]">
        YTD performance by holding
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 20 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}%`}
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="ticker"
            width={40}
            stroke="#6b7280"
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`, "YTD"]}
            contentStyle={{
              backgroundColor: "#0f1f35",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="ytd" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
