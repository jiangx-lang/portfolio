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
import {
  ChronicleStructureView,
  hasStructureVisual,
} from "@/components/chronicle/ChronicleStructureView";

type AnyRec = Record<string, unknown>;

type View =
  | { kind: "area"; series: AnyRec[]; yKeys: string[]; xKey: string }
  | { kind: "signed-bar"; series: AnyRec[]; xKey: string; yKey: string }
  | { kind: "drawdown-bar"; series: AnyRec[]; xKey: string }
  | { kind: "rank-bar"; series: AnyRec[]; xKey: string; yKey: string };

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

/** series 为命名字典：{ sox_vs_spx: [{date,value}, ...] } */
function dictSeriesParts(series: unknown): { key: string; points: AnyRec[] }[] {
  if (!series || typeof series !== "object" || Array.isArray(series)) return [];
  return Object.entries(series as Record<string, unknown>)
    .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length >= 2)
    .map(([key, points]) => ({ key, points: points as AnyRec[] }))
    .filter(({ points }) => {
      const s = points[0];
      return s && typeof s === "object" && ("date" in s || "year" in s);
    });
}

function mergeNamedSeries(
  parts: { key: string; points: AnyRec[] }[],
  fieldPrefer = ["value", "close", "pe", "weight"]
): View | null {
  if (!parts.length) return null;
  const byDate = new Map<string, AnyRec>();
  for (const m of parts.slice(0, 4)) {
    const vk =
      valueKeys(m.points).find((k) => fieldPrefer.includes(k)) ||
      valueKeys(m.points)[0] ||
      "value";
    for (const p of m.points) {
      const d = String(p.date || p.year || "");
      if (!d) continue;
      const row = byDate.get(d) || { date: d };
      const n = Number(p[vk]);
      if (Number.isFinite(n)) row[m.key] = n;
      byDate.set(d, row);
    }
  }
  const merged = Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  if (merged.length < 2) return null;
  return {
    kind: "area",
    series: downsampleSeries(merged, 1400),
    yKeys: parts.slice(0, 4).map((c) => c.key),
    xKey: "date",
  };
}

function rankBarFrom(
  rows: AnyRec[],
  labelKey: string,
  valueKey: string,
  limit = 12
): View | null {
  const series = rows
    .map((p) => ({
      label: String(p[labelKey] ?? ""),
      _v: Number(p[valueKey]),
    }))
    .filter((r) => r.label && Number.isFinite(r._v))
    .slice(0, limit);
  if (series.length < 2) return null;
  return { kind: "rank-bar", series, xKey: "label", yKey: "_v" };
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

function buildView(data: unknown, panelId?: string): View | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as AnyRec;
  const id = (panelId || "").toLowerCase();

  // —— 同文件多面板：按 id 优先切片 ——
  if (id === "cp-conc-size") {
    const ss = obj.sizeSeries as AnyRec | undefined;
    if (ss && Array.isArray(ss.months) && Array.isArray(ss.iwb)) {
      const months = ss.months as string[];
      const iwb = ss.iwb as number[];
      const iwm = Array.isArray(ss.iwm) ? (ss.iwm as number[]) : [];
      const series = months.map((m, i) => ({
        date: m,
        iwb: iwb[i],
        ...(iwm.length ? { iwm: iwm[i] } : {}),
      }));
      return {
        kind: "area",
        series: downsampleSeries(series, 1400),
        yKeys: iwm.length ? ["iwb", "iwm"] : ["iwb"],
        xKey: "date",
      };
    }
  }
  if (id === "cp-conc-top3") {
    const t3 = obj.top3Relative as AnyRec | undefined;
    if (t3 && Array.isArray(t3.years) && Array.isArray(t3.pos1)) {
      const years = t3.years as number[];
      const series = years.map((y, i) => ({
        date: String(y),
        pos1: Number((t3.pos1 as number[])[i]),
        pos2: Number((t3.pos2 as number[] | undefined)?.[i]),
        pos3: Number((t3.pos3 as number[] | undefined)?.[i]),
      }));
      return { kind: "area", series, yKeys: ["pos1", "pos2", "pos3"], xKey: "date" };
    }
  }
  if (id === "cp-dd-timing") {
    const timing = obj.timing as AnyRec | undefined;
    const peaks = Array.isArray(timing?.peaks) ? (timing!.peaks as AnyRec[]) : [];
    if (peaks.length >= 2) {
      return {
        kind: "area",
        series: downsampleSeries(
          peaks.map((p) => ({ date: String(p.m), peaks: Number(p.c) })),
          800
        ),
        yKeys: ["peaks"],
        xKey: "date",
      };
    }
  }
  if (id === "cp-dd-paths") {
    const rp = obj.recoveryPaths as AnyRec | undefined;
    const median = Array.isArray(rp?.median) ? (rp!.median as number[]) : [];
    if (median.length >= 2) {
      return {
        kind: "area",
        series: median.map((v, i) => ({ date: String(i), median: v })),
        yKeys: ["median"],
        xKey: "date",
      };
    }
  }
  if (id === "cp-dd-forward-returns" && Array.isArray(obj.bins)) {
    const series = (obj.bins as AnyRec[])
      .map((b) => {
        const fwd = b.fwdTsrMedian as Record<string, number> | undefined;
        const v = fwd && typeof fwd["5"] === "number" ? fwd["5"] * 100 : NaN;
        return { label: String(b.bin), _v: v };
      })
      .filter((r) => r.label && Number.isFinite(r._v));
    if (series.length >= 2) {
      return { kind: "rank-bar", series, xKey: "label", yKey: "_v" };
    }
  }
  if (id === "cp-dd-base-rates" && Array.isArray(obj.bins)) {
    const sample = obj.bins[0] as AnyRec;
    if ("bin" in sample && isNum(sample.count)) {
      return {
        kind: "rank-bar",
        series: (obj.bins as AnyRec[]).map((b) => ({
          label: String(b.bin),
          _v: Number(b.count),
        })),
        xKey: "label",
        yKey: "_v",
      };
    }
  }

  // dict-of-series（semi/ratios）
  {
    const parts = dictSeriesParts(obj.series);
    if (parts.length) {
      const merged = mergeNamedSeries(parts);
      if (merged) return merged;
    }
  }

  // 成员嵌套时间序列（memory-valuation PE）
  if (Array.isArray(obj.members) && obj.members.length) {
    const nested = (obj.members as AnyRec[])
      .filter((m) => Array.isArray(m.series) && (m.series as AnyRec[]).length >= 2)
      .map((m) => ({
        key: String(m.ticker || m.name || "s"),
        points: m.series as AnyRec[],
      }));
    if (nested.length) {
      const pe = mergeNamedSeries(nested, ["pe", "value", "price"]);
      if (pe) return pe;
    }
  }

  // 持仓 / 权重条
  if (Array.isArray(obj.cumulativeWeights) && obj.cumulativeWeights.length >= 2) {
    const v = rankBarFrom(obj.cumulativeWeights as AnyRec[], "ticker", "cumulative", 12);
    if (v) return v;
  }
  if (Array.isArray(obj.members) && obj.members.length >= 2) {
    const sample = obj.members[0] as AnyRec;
    if (isNum(sample.weight) || isNum(sample.etfWeight)) {
      const key = isNum(sample.weight) ? "weight" : "etfWeight";
      const v = rankBarFrom(obj.members as AnyRec[], "ticker", key, 12);
      if (v) return v;
    }
  }
  if (Array.isArray(obj.subsectors) && obj.subsectors.length >= 2) {
    const sample = obj.subsectors[0] as AnyRec;
    if (isNum(sample.weight)) {
      const v = rankBarFrom(
        (obj.subsectors as AnyRec[]).map((s) => ({
          ...s,
          ticker: String(s.name_cn || s.name_en || s.id || s.name || ""),
        })),
        "ticker",
        "weight",
        12
      );
      if (v) return v;
    }
    if (isNum(sample.count)) {
      const v = rankBarFrom(
        (obj.subsectors as AnyRec[]).map((s) => ({
          ...s,
          ticker: String(s.name_cn || s.name_en || s.id || ""),
          weight: Number(s.count),
        })),
        "ticker",
        "weight",
        12
      );
      if (v) return v;
    }
  }
  if (Array.isArray(obj.sectors) && obj.sectors.length >= 2) {
    const v = rankBarFrom(
      (obj.sectors as AnyRec[]).map((s) => ({
        ticker: String(s.name || s.english || s.id || ""),
        weight: Number(s.weight),
      })),
      "ticker",
      "weight",
      12
    );
    if (v) return v;
  }

  // 指数合成序列
  if (Array.isArray(obj.indexSeries) && obj.indexSeries.length >= 2) {
    const series = downsampleSeries(obj.indexSeries as AnyRec[]);
    return { kind: "area", series, yKeys: ["value"], xKey: "date" };
  }

  // 集中度 paperExtension.points
  {
    const pe = obj.paperExtension as AnyRec | undefined;
    if (pe && Array.isArray(pe.points) && pe.points.length >= 2) {
      const series = (pe.points as AnyRec[]).map((p) => ({
        date: String(p.year ?? p.date ?? ""),
        top1: Number(p.top1),
        top3: Number(p.top3),
        top10: Number(p.top10),
      }));
      return { kind: "area", series, yKeys: ["top10", "top3", "top1"], xKey: "date" };
    }
  }

  // 大小盘 sizeSeries
  {
    const ss = obj.sizeSeries as AnyRec | undefined;
    if (ss && Array.isArray(ss.months) && Array.isArray(ss.iwb)) {
      const months = ss.months as string[];
      const iwb = ss.iwb as number[];
      const iwm = Array.isArray(ss.iwm) ? (ss.iwm as number[]) : [];
      const series = months.map((m, i) => ({
        date: m,
        iwb: iwb[i],
        ...(iwm.length ? { iwm: iwm[i] } : {}),
      }));
      return {
        kind: "area",
        series: downsampleSeries(series, 1400),
        yKeys: iwm.length ? ["iwb", "iwm"] : ["iwb"],
        xKey: "date",
      };
    }
  }

  // top3 相对收益
  {
    const t3 = obj.top3Relative as AnyRec | undefined;
    if (t3 && Array.isArray(t3.years) && Array.isArray(t3.pos1)) {
      const years = t3.years as number[];
      const series = years.map((y, i) => ({
        date: String(y),
        pos1: Number((t3.pos1 as number[])[i]),
        pos2: Number((t3.pos2 as number[] | undefined)?.[i]),
        pos3: Number((t3.pos3 as number[] | undefined)?.[i]),
      }));
      return { kind: "area", series, yKeys: ["pos1", "pos2", "pos3"], xKey: "date" };
    }
  }

  // 回撤分桶 bins
  if (Array.isArray(obj.bins) && obj.bins.length >= 2) {
    const sample = obj.bins[0] as AnyRec;
    if ("bin" in sample && isNum(sample.count)) {
      return {
        kind: "rank-bar",
        series: (obj.bins as AnyRec[]).map((b) => ({
          label: String(b.bin),
          _v: Number(b.count),
        })),
        xKey: "label",
        yKey: "_v",
      };
    }
  }

  // 危机回撤名单 → 幅度条
  if (Array.isArray(obj.casualties) || Array.isArray(obj.survivors)) {
    const rows = [
      ...((obj.casualties as AnyRec[]) || []),
      ...((obj.survivors as AnyRec[]) || []),
    ].map((r) => {
      const peak = Number(r.peak);
      const trough = Number(r.trough);
      const dd =
        Number.isFinite(peak) && peak !== 0 && Number.isFinite(trough)
          ? Math.abs((trough / peak - 1) * 100)
          : NaN;
      return { label: String(r.ticker || r.name || ""), decline: dd };
    }).filter((r) => r.label && Number.isFinite(r.decline));
    if (rows.length >= 2) {
      return { kind: "drawdown-bar", series: rows, xKey: "label" };
    }
  }

  // 世代峰值权重
  if (Array.isArray(obj.generations) && obj.generations.length) {
    const series = (obj.generations as AnyRec[])
      .map((g) => ({
        label: String(g.label_cn || g.label_en || g.id || g.peakYear || ""),
        _v: Number(g.peakWeight ?? (Array.isArray(g.members) ? g.members.length : NaN)),
      }))
      .filter((r) => r.label && Number.isFinite(r._v));
    if (series.length >= 2) {
      return { kind: "rank-bar", series, xKey: "label", yKey: "_v" };
    }
  }

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
        // 小数刻度数据（如 -0.14）统一转百分点，避免 Y 轴出现 "-0%"
        const maxAbs = Math.max(...series.map((s) => Math.abs(Number(s._v))), 0);
        if (maxAbs > 0 && maxAbs <= 2) {
          for (const s of series) s._v = Number(s._v) * 100;
        }
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
  const chosen = (preferred.length ? preferred : multi)
    .slice(0, 3)
    // 覆盖期最长的序列排最前，担任主视觉（金色面积图）
    .sort((a, b) => b.points.length - a.points.length);

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
      const series = points.map((p) => ({
        ...p,
        label: String(p.year ?? p.date ?? p.period ?? ""),
        _v: Number(p[yKey] ?? 0),
      }));
      // 小数刻度数据（如 -0.14）统一转百分点，避免 Y 轴出现 "-0%"
      const maxAbs = Math.max(...series.map((s) => Math.abs(s._v)), 0);
      if (maxAbs > 0 && maxAbs <= 2) {
        for (const s of series) s._v = s._v * 100;
      }
      return {
        kind: "signed-bar",
        series,
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
  panelId,
}: {
  data: unknown;
  title?: string;
  /** Hub 旗舰预览：去卡片框、去说明表、压缩高度 */
  compact?: boolean;
  height?: number;
  /** 同 JSON 多面板时按 id 选择切片 */
  panelId?: string;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const view = useMemo(() => buildView(data, panelId), [data, panelId]);
  const obj = data && typeof data === "object" ? (data as AnyRec) : null;
  const chartH = height ?? (compact ? 280 : 400);

  // 跨数量级的长周期走势（如 118 → 11867 的 100 倍曲线）自动切换对数坐标
  const logScale = useMemo(() => {
    if (!view || view.kind !== "area") return false;
    const key = view.yKeys[0];
    const vals = view.series
      .map((r) => Number(r[key]))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length < 10) return false;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return min > 0 && max / min >= 25;
  }, [view]);

  if (!view) {
    if (hasStructureVisual(data)) {
      const body = (
        <div className={compact ? "py-2" : "p-4"} style={{ minHeight: compact ? chartH : undefined }}>
          <ChronicleStructureView data={data} compact={compact} />
        </div>
      );
      if (compact) return body;
      return <div className="glass-card glow-border">{body}</div>;
    }
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
          ) : view.kind === "rank-bar" ? (
            <BarChart data={view.series} margin={{ top: 8, right: 8, left: 0, bottom: compact ? 8 : 28 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey={view.xKey}
                tick={{ fill: "#66738c", fontSize: 9 }}
                interval={0}
                angle={compact ? -25 : -35}
                textAnchor="end"
                height={compact ? 48 : 64}
              />
              <YAxis tick={{ fill: "#66738c", fontSize: 10 }} width={44} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey={view.yKey} fill="#C9A84C" radius={[4, 4, 0, 0]} />
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
              <YAxis
                tick={{ fill: "#66738c", fontSize: 10 }}
                width={52}
                {...(logScale
                  ? {
                      scale: "log" as const,
                      domain: ["auto", "auto"] as const,
                      allowDataOverflow: true,
                    }
                  : {})}
              />
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
