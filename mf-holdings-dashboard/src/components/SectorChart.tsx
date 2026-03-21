"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { Holding } from "@/types";

const COLORS = [
  "#185FA5",
  "#7F77DD",
  "#1D9E75",
  "#D85A30",
  "#854F0B",
  "#0F6E56",
];

interface SectorChartProps {
  holdings: Holding[];
}

export function SectorChart({ holdings }: SectorChartProps) {
  const bySector = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.sector] = (acc[h.sector] ?? 0) + h.weight;
    return acc;
  }, {});
  const data = Object.entries(bySector).map(([name, value]) => ({
    name,
    value: Math.round(value * 10) / 10,
  }));

  return (
    <div className="h-[280px] w-full rounded-xl border border-white/10 bg-navy-card p-4">
      <p className="mb-2 text-sm font-medium text-white/80">
        Sector allocation
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Weight"]}
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
