import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ChronicleVisual } from "@/components/chronicle/ChronicleVisual";
import { getSyncMeta, loadPanelDataset, loadProfilePanels } from "@/lib/chronicle/load";
import { datasetPathFromUrl } from "@/lib/chronicle/types";
import { LATEST_KEY_ZH, PANEL_ZH } from "@/lib/chronicle/zh";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const panels = await loadProfilePanels();
  const panel = panels.find((p) => p.id === decodeURIComponent(params.id));
  return {
    title: panel ? `${panel.title} · 美股编年史` : "美股编年史",
  };
}

function summarize(data: unknown): { label: string; value: string; tone?: "rise" | "fall" | "flat" }[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const rows: { label: string; value: string; tone?: "rise" | "fall" | "flat" }[] = [];

  const push = (label: string, value: unknown, tone?: "rise" | "fall" | "flat") => {
    if (value == null || typeof value === "object") return;
    rows.push({ label, value: String(value), tone });
  };

  push("更新", o.updated);
  push("标的", o.ticker);
  if (typeof o.average === "number") {
    push("均值", `${o.average.toFixed?.(1) ?? o.average}%`);
  }
  push("上涨年", o.positiveYears, "rise");
  push("下跌年", o.negativeYears, "fall");
  push("最近年", o.latestYear);

  if (o.latest && typeof o.latest === "object") {
    const latest = o.latest as Record<string, unknown>;
    for (const [k, v] of Object.entries(latest).slice(0, 4)) {
      // 跳过日期键、长文本与布尔值，避免摘要卡出现 "最新·NOTE" 这类原始字段
      if (/^(date|year|day|time)$/i.test(k)) continue;
      if (typeof v === "boolean" || v === "true" || v === "false") continue;
      if (typeof v === "string" && v.length > 24) continue;
      push(`最新·${LATEST_KEY_ZH[k.toLowerCase()] ?? k}`, v);
    }
  }
  if (o.best && typeof o.best === "object") {
    const best = o.best as Record<string, unknown>;
    push("最佳", `${best.year ?? ""} ${best.value ?? best.return ?? ""}`.trim(), "rise");
  }
  if (o.worst && typeof o.worst === "object") {
    const worst = o.worst as Record<string, unknown>;
    push("最差", `${worst.year ?? ""} ${worst.value ?? worst.return ?? ""}`.trim(), "fall");
  }

  return rows.slice(0, 8);
}

export default async function ChroniclePanelPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);
  const panels = await loadProfilePanels();
  const panel = panels.find((p) => p.id === id);
  if (!panel) notFound();

  let data: unknown = null;
  let error: string | null = null;
  try {
    data = await loadPanelDataset(panel);
  } catch (e) {
    error = e instanceof Error ? e.message : "加载失败";
  }

  const rel = datasetPathFromUrl(panel.dataset);
  const stats = summarize(data);
  const meta = getSyncMeta();
  const idx = panels.findIndex((p) => p.id === id);
  const prev = idx > 0 ? panels[idx - 1] : null;
  const next = idx >= 0 && idx < panels.length - 1 ? panels[idx + 1] : null;

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-20 pb-28">
        <Link
          href="/chronicle"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回编年史目录
        </Link>

        <header className="mb-8 animate-in">
          {panel.chapter ? <span className="eyebrow">{panel.chapter}</span> : null}
          <h1 className="font-display text-2xl sm:text-4xl font-bold mt-2 text-white">
            {panel.title}
          </h1>
          {PANEL_ZH[panel.id]?.q ? (
            <p className="text-sm sm:text-base text-slate-400 mt-3 max-w-3xl leading-relaxed">
              {PANEL_ZH[panel.id].q}
            </p>
          ) : null}
          {PANEL_ZH[panel.id]?.h ? (
            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm text-gold-light leading-relaxed">
              {PANEL_ZH[panel.id].h}
            </div>
          ) : null}
        </header>

        {stats.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="glass-card px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  {s.label}
                </div>
                <div
                  className={`mt-1 text-sm font-semibold font-mono truncate ${
                    s.tone === "rise"
                      ? "text-rise"
                      : s.tone === "fall"
                        ? "text-fall"
                        : "text-slate-100"
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rise/30 bg-rise/10 p-4 text-sm text-rise">
            数据加载失败：{error}
          </div>
        ) : (
          <ChronicleVisual id={panel.id} data={data} />
        )}

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/api/chronicle/${rel}`}
            className="btn-ghost inline-flex items-center gap-1.5 !py-2 !px-3 text-xs"
          >
            数据 API（JSON）
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link href={`/chronicle/${encodeURIComponent(prev.id)}`} className="glass-card p-4 group">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">上一篇</div>
              <div className="mt-1 text-sm text-slate-200 group-hover:text-gold transition-colors line-clamp-2">
                {prev.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/chronicle/${encodeURIComponent(next.id)}`}
              className="glass-card p-4 group text-right sm:text-left"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-500">下一篇</div>
              <div className="mt-1 text-sm text-slate-200 group-hover:text-gold transition-colors line-clamp-2">
                {next.title}
              </div>
            </Link>
          ) : null}
        </div>

        <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-600 leading-relaxed">
          数据来源：History of Market · 美股编年史（CC-BY-4.0 署名使用）。
          {meta.synced_at
            ? ` 本地镜像同步于 ${meta.synced_at}${meta.stale ? "（已过期，本页可能已回源更新）" : ""}。`
            : " 当前直接回源获取最新数据。"}
        </footer>
      </div>
    </div>
  );
}
