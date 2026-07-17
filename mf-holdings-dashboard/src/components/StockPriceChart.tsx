"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  ticker: string;
  currentPrice: number;
  /** 图表高度 px，手机可传 200，桌面 300 */
  chartHeight?: number;
}

export default function StockPriceChart({ ticker, currentPrice, chartHeight = 200 }: Props) {
  const [data, setData] = useState<{ date: string; price: number }[]>([]);
  const [range, setRange] = useState<"1M" | "3M" | "1Y">("3M");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stock-history/${encodeURIComponent(ticker)}?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        // 兼容历史接口两种响应结构：
        // 1) 旧：数组 [{date, price}, ...]
        // 2) 新：{ history: [{date, price}, ...] }
        const history = Array.isArray(d) ? d : Array.isArray(d?.history) ? d.history : [];
        setData(history);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker, range]);

  const first = data[0]?.price || currentPrice;
  const isPositive = currentPrice >= first;
  const returnPct = first > 0 ? (((currentPrice - first) / first) * 100).toFixed(1) : "0";

  return (
    <div className="mb-4 rounded-2xl border border-white/[0.07] bg-navy-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-slate-400">股价走势</span>
          <span className={`font-mono text-sm ${isPositive ? "text-rise" : "text-fall"}`}>
            {isPositive ? "+" : ""}
            {returnPct}% ({range})
          </span>
        </div>
        <div className="flex gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-0.5">
          {(["1M", "3M", "1Y"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] transition ${
                range === r
                  ? "bg-gradient-gold font-semibold text-slate-950"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: chartHeight }} />
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,194,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickFormatter={(v: string) => String(v).slice(5)}
              interval={Math.max(0, Math.floor(data.length / 5))}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
              domain={["auto", "auto"]}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(12,17,32,0.92)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 12,
                fontSize: 12,
                backdropFilter: "blur(12px)",
              }}
              labelStyle={{ color: "#9AA7BD" }}
              itemStyle={{ color: "#E3C87A" }}
              formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "股价"]}
              labelFormatter={(v) => String(v)}
            />
            <ReferenceLine y={first} stroke="rgba(148,163,194,0.2)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#C9A84C"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#C9A84C" }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div
          className="flex items-center justify-center text-xs text-slate-500"
          style={{ height: chartHeight }}
        >
          暂无历史数据
        </div>
      )}
    </div>
  );
}
