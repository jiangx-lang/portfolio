"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import { downsampleSeries } from "@/components/chronicle/load-client";

type AnyRec = Record<string, unknown>;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function pickSeries(data: AnyRec): { key: string; points: AnyRec[] }[] {
  const out: { key: string; points: AnyRec[] }[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (!Array.isArray(v) || v.length < 2) continue;
    const sample = v[0];
    if (!sample || typeof sample !== "object") continue;
    const s = sample as AnyRec;
    if ("date" in s || "year" in s || "period" in s) {
      out.push({ key: k, points: v as AnyRec[] });
    }
  }
  return out;
}

function valueKeys(points: AnyRec[]): string[] {
  const sample = points[0] || {};
  return Object.keys(sample).filter((k) => {
    if (
      [
        "date",
        "year",
        "period",
        "label",
        "name",
        "ticker",
        "cause",
        "causeEn",
        "category",
        "color",
        "id",
        "active",
        "recovery_date",
      ].includes(k)
    )
      return false;
    return isNum(sample[k]) || isNum(Number(sample[k]));
  });
}

const COLORS = ["#C9A84C", "#5B93F0", "#E85D50", "#2FBF8F", "#A78BFA", "#F97316"];

const tipStyle = {
  background: "rgba(12,17,32,0.96)",
  border: "1px solid rgba(201,168,76,0.28)",
  borderRadius: 12,
  fontSize: 12,
  color: "#F4F6FB",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
};

type View =
  | { kind: "area"; series: AnyRec[]; yKeys: string[]; xKey: string }
  | { kind: "signed-bar"; series: AnyRec[]; xKey: string; yKey: string }
  | { kind: "drawdown-bar"; series: AnyRec[]; xKey: string };

function buildView(data: unknown): View | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as AnyRec;

  if (Array.isArray(obj.series) && obj.series.length) {
    const sample = obj.series[0] as AnyRec;
    // annual returns: year + return/value
    if ("year" in sample || ("return" in sample && !("close" in sample))) {
      const series = (obj.series as AnyRec[]).map((p) => {
        const yKey = isNum(p.return)
          ? "return"
          : isNum(p.value)
            ? "value"
            : isNum(p.tr)
              ? "tr"
              : valueKeys([p])[0];
        return {
          ...p,
          _v: Number(p[yKey as string] ?? 0),
          label: String(p.year ?? p.date ?? ""),
        };
      });
      if (series.every((s) => "label" in s) && series.length < 120) {
        return { kind: "signed-bar", series, xKey: "label", yKey: "_v" };
      }
    }
    const series = downsampleSeries(obj.series as AnyRec[]);
    let yKeys = valueKeys(series).slice(0, 3);
    // prefer close/value
    yKeys = yKeys.sort((a, b) => {
      const score = (k: string) =>
        k === "close" ? 0 : k === "value" ? 1 : k === "drawdown" ? 3 : 2;
      return score(a) - score(b);
    });
    if (!yKeys.length) return null;
    return {
      kind: "area",
      series,
      yKeys: yKeys.filter((k) => k !== "drawdown").slice(0, 2),
      xKey: "date" in series[0] ? "date" : "year",
    };
  }

  const multi = pickSeries(obj);
  if (!multi.length) {
    if (Array.isArray(data) && data.length) {
      const series = downsampleSeries(data as AnyRec[]);
      const yKeys = valueKeys(series).slice(0, 2);
      if (!yKeys.length) return null;
      const xKey = "date" in series[0] ? "date" : "year" in series[0] ? "year" : "period";
      return { kind: "area", series, yKeys, xKey };
    }
    return null;
  }

  const preferred = multi.filter((m) =>
    /^(pe|cape|series|price|drawdowns|annual)/i.test(m.key)
  );
  const chosen = (preferred.length ? preferred : multi).slice(0, 3);

  if (chosen.length === 1) {
    const points = downsampleSeries(chosen[0].points);
    const yKeys = valueKeys(points).slice(0, 2);
    const xKey =
      "date" in points[0] ? "date" : "year" in points[0] ? "year" : "period";

    if (chosen[0].key === "drawdowns" || yKeys.includes("decline")) {
      return {
        kind: "drawdown-bar",
        series: points.slice(0, 36).map((p) => {
          const raw = Number(p.decline ?? p.value ?? 0);
          const pct = Math.abs(raw) <= 2 ? Math.abs(raw) * 100 : Math.abs(raw);
          return {
            ...p,
            label: String(p.period || p.date || ""),
            decline: pct,
          };
        }),
        xKey: "label",
      };
    }

    // annual-like single series
    if (xKey === "year" || (points.length < 120 && yKeys[0] && /return|tr|value/i.test(yKeys[0]))) {
      const yKey = yKeys[0];
      return {
        kind: "signed-bar",
        series: points.map((p) => ({
          ...p,
          label: String(p.year ?? p.date ?? p.period ?? ""),
          _v: Number(p[yKey] ?? 0),
        })),
        xKey: "label",
        yKey: "_v",
      };
    }

    return { kind: "area", series: points, yKeys, xKey };
  }

  const byDate = new Map<string, AnyRec>();
  for (const m of chosen) {
    // 合并后再降采样：多条序列独立降采样会因采样点错位导致逐点断线
    const vk = valueKeys(m.points)[0] || "value";
    for (const p of m.points) {
      const d = String(p.date || p.year || "");
      if (!d) continue;
      const row = byDate.get(d) || { date: d };
      row[m.key] = p[vk] ?? p.value ?? p.close;
      byDate.set(d, row);
    }
  }
  const merged = Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  const series = downsampleSeries(merged, 1400);
  return {
    kind: "area",
    series,
    yKeys: chosen.map((c) => c.key),
    xKey: "date",
  };
}

function DrawdownTable({ data }: { data: AnyRec }) {
  const rows = Array.isArray(data.drawdowns) ? (data.drawdowns as AnyRec[]).slice(0, 12) : [];
  if (!rows.length) return null;
  return (
    <div className="atlas-table-wrap mt-5">
      <table className="atlas-table text-sm">
        <thead>
          <tr>
            <th>区间</th>
            <th>回撤</th>
            <th>天数</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="font-mono text-xs">{String(r.period || "")}</td>
              <td className="font-mono text-fall">
                {isNum(r.decline)
                  ? `${(Math.abs(r.decline) <= 2 ? r.decline * 100 : r.decline).toFixed(1)}%`
                  : "—"}
              </td>
              <td className="font-mono num">{String(r.days ?? "—")}</td>
              <td className="text-slate-400 max-w-[240px] truncate">
                {String(r.cause || r.causeEn || r.category || "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChronicleChart({
  data,
  title,
  compact = false,
  height,
}: {
  data: unknown;
  title?: string;
  /** Hub 旗舰预览：去卡片框、去说明表、压缩高度 */
  compact?: boolean;
  height?: number;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const view = useMemo(() => buildView(data), [data]);
  const obj = data && typeof data === "object" ? (data as AnyRec) : null;
  const chartH = height ?? (compact ? 280 : 400);

  if (!view) {
    if (compact) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          打开面板查看完整数据
        </div>
      );
    }
    return (
      <div className="glass-card p-6 text-sm text-slate-400">
        此数据集以结构化字段为主，摘要如下；完整数据可通过 API 获取。
        {obj && Array.isArray(obj.drawdowns) ? <DrawdownTable data={obj} /> : null}
      </div>
    );
  }

  const tickFmt = (v: string) => (v?.length > 7 ? v.slice(0, 7) : v);

  const chartBody = (
    <>
      {title && !compact ? (
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="text-sm font-medium text-slate-200">{title}</div>
          {view.kind === "area" ? (
            <div className="flex flex-wrap gap-2">
              {view.yKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))}
                  className={`badge ${hidden[k] ? "opacity-40" : "badge-gold"}`}
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="w-full" style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          {view.kind === "signed-bar" ? (
            <BarChart data={view.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={view.xKey}
                tick={{ fill: "#66738c", fontSize: compact ? 9 : 10 }}
                interval="preserveStartEnd"
                minTickGap={compact ? 36 : 24}
              />
              <YAxis
                tick={{ fill: "#66738c", fontSize: 10 }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                width={44}
              />
              <ReferenceLine y={0} stroke="rgba(148,163,194,0.35)" />
              <Tooltip
                contentStyle={tipStyle}
                formatter={(v: number) => [`${Number(v).toFixed(2)}%`, "回报"]}
              />
              <Bar dataKey={view.yKey} radius={[4, 4, 0, 0]}>
                {view.series.map((row, i) => (
                  <Cell
                    key={i}
                    fill={Number(row[view.yKey]) >= 0 ? "#E85D50" : "#2FBF8F"}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : view.kind === "drawdown-bar" ? (
            <BarChart
              data={view.series}
              margin={{ top: 8, right: 8, left: 0, bottom: compact ? 8 : 40 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={view.xKey}
                tick={{ fill: "#66738c", fontSize: 9 }}
                interval={compact ? "preserveStartEnd" : 0}
                angle={compact ? 0 : -35}
                textAnchor={compact ? "middle" : "end"}
                height={compact ? 28 : 60}
                minTickGap={32}
              />
              <YAxis tick={{ fill: "#66738c", fontSize: 10 }} width={44} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="decline" fill="#C9A84C" name="回撤幅度" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={view.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="atlasGoldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={view.xKey}
                tick={{ fill: "#66738c", fontSize: 10 }}
                minTickGap={compact ? 64 : 48}
                tickFormatter={tickFmt}
              />
              <YAxis tick={{ fill: "#66738c", fontSize: 10 }} width={52} />
              <Tooltip contentStyle={tipStyle} />
              {!compact ? <Legend /> : null}
              {view.yKeys.map((k, i) =>
                hidden[k] ? null : i === 0 ? (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={COLORS[i % COLORS.length]}
                    fill="url(#atlasGoldFill)"
                    strokeWidth={1.7}
                    dot={false}
                    name={k}
                    connectNulls
                  />
                ) : (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    name={k}
                    connectNulls
                  />
                )
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {!compact && obj && Array.isArray(obj.drawdowns) ? <DrawdownTable data={obj} /> : null}
    </>
  );

  if (compact) return <div className="w-full">{chartBody}</div>;

  return <div className="glass-card p-3 sm:p-5 glow-border">{chartBody}</div>;
}
