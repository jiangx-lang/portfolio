import { loadChronicleJson } from "@/lib/chronicle/load";

/** 今日数据带：把当日指标放进百年语境（对标原站首页数据条） */

type SeriesPoint = { date?: string; close?: number; value?: number; weight?: number };

function asSeries(data: unknown, key?: string): SeriesPoint[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const arr = key ? o[key] : o.series;
  return Array.isArray(arr) ? (arr as SeriesPoint[]) : [];
}

function pct(a: number, b: number): number {
  return b !== 0 ? (a / b - 1) * 100 : 0;
}

/** 近 30 个交易日迷你走势（内联 SVG，金色描边） */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 132;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 4 - ((p - min) / span) * (h - 8)).toFixed(1)}`
    )
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path
        d={d}
        fill="none"
        stroke={up ? "#e85d50" : "#2fbf8f"}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export async function TodayStrip() {
  const [price, vix, fpe, mag7] = await Promise.all([
    loadChronicleJson("sp500/price.json").catch(() => null),
    loadChronicleJson("sp500/vix.json").catch(() => null),
    loadChronicleJson("sp500/forward-pe.json").catch(() => null),
    loadChronicleJson("mag7/concentration.json").catch(() => null),
  ]);

  const px = asSeries(price);
  if (!px.length) return null;

  const last = px[px.length - 1];
  const prev = px[px.length - 2];
  const lastClose = Number(last?.close ?? 0);
  const prevClose = Number(prev?.close ?? lastClose);
  const dailyPct = pct(lastClose, prevClose);
  const highClose = Math.max(...px.map((p) => Number(p.close ?? 0)));
  const ddFromHigh = pct(lastClose, highClose);
  const spark30 = px.slice(-30).map((p) => Number(p.close ?? 0));

  const vx = asSeries(vix);
  const vixLatest = vx.length ? Number(vx[vx.length - 1]?.value ?? 0) : null;
  const vixPctile =
    vixLatest != null && vx.length
      ? Math.round(
          (vx.filter((p) => Number(p.value ?? 0) <= vixLatest).length / vx.length) * 100
        )
      : null;

  const fwd = asSeries(fpe, "forward");
  const trl = asSeries(fpe, "trailing");
  const fwdLatest = fwd.length ? Number(fwd[fwd.length - 1]?.value ?? 0) : null;
  const trlLatest = trl.length ? Number(trl[trl.length - 1]?.value ?? 0) : null;

  const m7 = asSeries(mag7);
  const m7Latest = m7.length ? Number(m7[m7.length - 1]?.weight ?? 0) : null;
  const m7Peak = m7.length ? Math.max(...m7.map((p) => Number(p.weight ?? 0))) : null;

  const metrics: {
    label: string;
    value: string;
    sub?: string;
    tone?: "rise" | "fall" | "flat";
  }[] = [
    {
      label: "S&P 500",
      value: `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}%`,
      sub: "近 30 日",
      tone: dailyPct > 0 ? "rise" : dailyPct < 0 ? "fall" : "flat",
    },
    {
      label: "Drawdown",
      value: `${ddFromHigh.toFixed(1)}%`,
      sub: "距历史高点",
      tone: ddFromHigh < -0.01 ? "fall" : "flat",
    },
  ];
  if (vixLatest != null) {
    metrics.push({
      label: "VIX",
      value: vixLatest.toFixed(1),
      sub: vixPctile != null ? `高于 ${vixPctile}% 的历史读数` : undefined,
    });
  }
  if (fwdLatest != null) {
    metrics.push({
      label: "Forward P/E",
      value: `${fwdLatest.toFixed(1)}×`,
      sub: trlLatest != null ? `Trailing ${trlLatest.toFixed(1)}×` : undefined,
    });
  }
  if (m7Latest != null) {
    metrics.push({
      label: "Mag 7",
      value: `${m7Latest.toFixed(1)}%`,
      sub: m7Peak != null ? `峰值 ${m7Peak.toFixed(1)}%` : undefined,
    });
  }

  return (
    <section className="glass-panel glow-border animate-in relative overflow-hidden px-5 py-5 sm:px-7 mb-10">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="eyebrow">今日 · 放进一百年里看</span>
        <span className="text-[11px] text-slate-500">
          数据截至 {last?.date ?? "—"} 收盘
        </span>
      </div>
      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-white/[0.07]">
        <div className="flex flex-col justify-between pr-4 lg:px-4 lg:!pl-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            近 30 日走势
          </div>
          <div className="mt-2">
            <Sparkline points={spark30} />
          </div>
        </div>
        {metrics.map((m) => (
          <div key={m.label} className="pr-4 lg:px-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {m.label}
            </div>
            <div
              className={`num mt-1.5 text-xl font-semibold sm:text-2xl ${
                m.tone === "rise"
                  ? "text-rise"
                  : m.tone === "fall"
                    ? "text-fall"
                    : "text-slate-100"
              }`}
            >
              {m.value}
            </div>
            {m.sub ? <div className="mt-1 text-[11px] text-slate-500">{m.sub}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
