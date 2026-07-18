"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  LineChart,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { ChronicleChart } from "@/components/chronicle/ChronicleChart";
import { downsampleSeries } from "@/components/chronicle/load-client";

type AnyRec = Record<string, unknown>;

const tipStyle = {
  background: "rgba(12,17,32,0.96)",
  border: "1px solid rgba(201,168,76,0.28)",
  borderRadius: 12,
  fontSize: 12,
  color: "#F4F6FB",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
};

function seriesOf(data: unknown, key?: string): AnyRec[] {
  if (!data || typeof data !== "object") return [];
  const o = data as AnyRec;
  const arr = key ? o[key] : o.series;
  return Array.isArray(arr) ? (arr as AnyRec[]) : [];
}

/** 多条序列按日期合并（合并后才允许降采样，避免采样点错位断线） */
function mergeByDate(parts: { key: string; points: AnyRec[]; field: string }[]): AnyRec[] {
  const map = new Map<string, AnyRec>();
  for (const { key, points, field } of parts) {
    for (const p of points) {
      const d = String(p.date ?? "");
      if (!d) continue;
      const row = map.get(d) || { date: d };
      const v = Number(p[field]);
      if (Number.isFinite(v)) row[key] = v;
      map.set(d, row);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card glow-border p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div className="text-sm font-medium text-slate-200">{title}</div>
        {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
      </div>
      <div className="h-[420px] w-full">{children}</div>
    </div>
  );
}

/* ---- 对数同比 · 牛熊分界（sp500-logyoy） ---- */
function LogYoYChart({ data }: { data: unknown }) {
  const series = useMemo(() => {
    const raw = seriesOf(data)
      .map((p) => ({ date: String(p.date ?? ""), v: Number(p.value) }))
      .filter((p) => Number.isFinite(p.v) && p.v > 0);
    const out: { date: string; yoy: number }[] = [];
    for (let i = 12; i < raw.length; i++) {
      out.push({
        date: raw[i].date,
        yoy: Math.log(raw[i].v / raw[i - 12].v) * 100,
      });
    }
    return out;
  }, [data]);
  if (!series.length) return <ChronicleChart data={data} title="数据可视化" />;
  return (
    <ChartCard
      title="对数同比 · 牛熊分界"
      sub=">0 牛市 · <0 熊市（零线穿越即牛熊转换）"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yoyGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#66738c", fontSize: 10 }}
            minTickGap={72}
            tickFormatter={(v: string) => v.slice(0, 4)}
          />
          <YAxis
            tick={{ fill: "#66738c", fontSize: 10 }}
            width={48}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(v: number) => [`${Number(v).toFixed(1)}%`, "对数同比"]}
          />
          <ReferenceLine
            y={0}
            stroke="rgba(201,168,76,0.6)"
            strokeDasharray="6 4"
            label={{ value: "牛熊分界", fill: "#c9a84c", fontSize: 10, position: "insideTopLeft" }}
          />
          <Area
            type="monotone"
            dataKey="yoy"
            stroke="#C9A84C"
            fill="url(#yoyGold)"
            strokeWidth={1.7}
            dot={false}
            name="对数同比"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---- Shiller CAPE 分位（pe） ---- */
function CapeChart({ data }: { data: unknown }) {
  const { series, mean } = useMemo(() => {
    const merged = mergeByDate([
      { key: "pe", points: seriesOf(data, "pe"), field: "value" },
      { key: "cape", points: seriesOf(data, "cape"), field: "value" },
    ]);
    const sampled = downsampleSeries(merged, 1400);
    const capes = seriesOf(data, "cape")
      .map((p) => Number(p.value))
      .filter((v) => Number.isFinite(v));
    const m = capes.length ? capes.reduce((a, b) => a + b, 0) / capes.length : null;
    return { series: sampled, mean: m };
  }, [data]);
  if (!series.length) return <ChronicleChart data={data} title="数据可视化" />;
  return (
    <ChartCard
      title="Shiller CAPE 与原始 PE"
      sub={mean != null ? `CAPE 历史均值 ≈ ${mean.toFixed(1)}×` : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="capeGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#66738c", fontSize: 10 }}
            minTickGap={72}
            tickFormatter={(v: string) => v.slice(0, 4)}
          />
          <YAxis tick={{ fill: "#66738c", fontSize: 10 }} width={48} />
          <Tooltip contentStyle={tipStyle} />
          <Legend />
          {mean != null ? (
            <ReferenceLine
              y={Number(mean.toFixed(1))}
              stroke="rgba(201,168,76,0.55)"
              strokeDasharray="6 4"
              label={{ value: `均值 ${mean.toFixed(1)}×`, fill: "#c9a84c", fontSize: 10, position: "insideTopLeft" }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="cape"
            stroke="#C9A84C"
            fill="url(#capeGold)"
            strokeWidth={1.8}
            dot={false}
            name="CAPE (PE10)"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="pe"
            stroke="#5B93F0"
            strokeWidth={1.2}
            dot={false}
            name="原始 PE"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---- 静态 / 动态市盈率（forward-pe） ---- */
function ForwardPeChart({ data }: { data: unknown }) {
  const { series, fwdLatest, trlLatest } = useMemo(() => {
    const merged = mergeByDate([
      { key: "trailing", points: seriesOf(data, "trailing"), field: "value" },
      { key: "forward", points: seriesOf(data, "forward"), field: "value" },
    ]);
    const sampled = downsampleSeries(merged, 1200);
    const fwd = seriesOf(data, "forward");
    const trl = seriesOf(data, "trailing");
    return {
      series: sampled,
      fwdLatest: fwd.length ? Number(fwd[fwd.length - 1]?.value) : null,
      trlLatest: trl.length ? Number(trl[trl.length - 1]?.value) : null,
    };
  }, [data]);
  if (!series.length) return <ChronicleChart data={data} title="数据可视化" />;
  return (
    <ChartCard
      title="静态 PE vs 动态 PE（Forward）"
      sub={
        fwdLatest != null && trlLatest != null
          ? `最新：动态 ${fwdLatest.toFixed(1)}× · 静态 ${trlLatest.toFixed(1)}×`
          : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#66738c", fontSize: 10 }}
            minTickGap={72}
            tickFormatter={(v: string) => v.slice(0, 4)}
          />
          <YAxis tick={{ fill: "#66738c", fontSize: 10 }} width={48} />
          <Tooltip contentStyle={tipStyle} />
          <Legend />
          <Line
            type="monotone"
            dataKey="forward"
            stroke="#C9A84C"
            strokeWidth={1.8}
            dot={false}
            name="动态 PE"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="trailing"
            stroke="#5B93F0"
            strokeWidth={1.2}
            dot={false}
            name="静态 PE"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---- 七姐妹市值占比（mag7-concentration） ---- */
function Mag7Chart({ data }: { data: unknown }) {
  const series = useMemo(
    () =>
      seriesOf(data).map((p) => ({
        date: String(p.date ?? "").slice(0, 4),
        weight: Number(p.weight),
      })),
    [data]
  );
  if (!series.length) return <ChronicleChart data={data} title="数据可视化" />;
  const latest = series[series.length - 1]?.weight;
  return (
    <ChartCard
      title="七姐妹占标普 500 流通市值"
      sub={latest != null ? `最新 ${latest.toFixed(1)}%` : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#66738c", fontSize: 10 }} minTickGap={16} />
          <YAxis
            tick={{ fill: "#66738c", fontSize: 10 }}
            width={48}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, "占比"]} />
          <Bar dataKey="weight" radius={[5, 5, 0, 0]} name="市值占比">
            {series.map((row, i) => (
              <Cell
                key={i}
                fill={i === series.length - 1 ? "#E3C87A" : "#C9A84C"}
                fillOpacity={i === series.length - 1 ? 1 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 按面板 id 分发：招牌面板用定制视图，其余走通用自动图 */
export function ChronicleVisual({ id, data }: { id: string; data: unknown }) {
  switch (id) {
    case "sp500-logyoy":
      return <LogYoYChart data={data} />;
    case "pe":
      return <CapeChart data={data} />;
    case "forward-pe":
      return <ForwardPeChart data={data} />;
    case "ndx-forward-pe":
      return <ForwardPeChart data={data} />;
    case "mag7-concentration":
      return <Mag7Chart data={data} />;
    default:
      return <ChronicleChart data={data} title="数据可视化" />;
  }
}
