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
    <div
      style={{
        background: "#111827",
        borderRadius: 12,
        border: "0.5px solid rgba(255,255,255,0.08)",
        padding: "clamp(0.75rem, 2vw, 1.25rem)",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>股价走势</span>
          <span
            style={{
              fontSize: 13,
              marginLeft: 12,
              color: isPositive ? "#1D9E75" : "#D85A30",
            }}
          >
            {isPositive ? "+" : ""}
            {returnPct}% ({range})
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["1M", "3M", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                border: range === r ? "0.5px solid #185FA5" : "0.5px solid rgba(255,255,255,0.1)",
                background: range === r ? "#185FA522" : "transparent",
                color: range === r ? "#60A5FA" : "#9CA3AF",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            height: chartHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9CA3AF",
            fontSize: 12,
          }}
        >
          加载走势数据...
        </div>
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6B7280" }}
              tickFormatter={(v: string) => String(v).slice(5)}
              interval={Math.max(0, Math.floor(data.length / 5))}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6B7280" }}
              tickFormatter={(v: number) => `$${Number(v).toFixed(0)}`}
              domain={["auto", "auto"]}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: "#1F2937",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "股价"]}
              labelFormatter={(v) => String(v)}
            />
            <ReferenceLine y={first} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#1D9E75" : "#D85A30"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            height: chartHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6B7280",
            fontSize: 12,
          }}
        >
          暂无历史数据
        </div>
      )}
    </div>
  );
}

