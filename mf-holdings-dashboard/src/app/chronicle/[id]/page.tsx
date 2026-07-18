import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ChronicleVisual } from "@/components/chronicle/ChronicleVisual";
import { getSyncMeta, loadPanelDataset, loadProfilePanels } from "@/lib/chronicle/load";
import { panelShortTitle, parseChapter } from "@/lib/chronicle/magazine";
import { datasetPathFromUrl } from "@/lib/chronicle/types";
import { LATEST_KEY_ZH, PANEL_ZH } from "@/lib/chronicle/zh";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const panels = await loadProfilePanels();
  const panel = panels.find((p) => p.id === decodeURIComponent(params.id));
  return {
    title: panel ? `${panelShortTitle(panel)} · 美股编年史` : "美股编年史",
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
  if (typeof o.average === "number") {
    push("均值", `${o.average.toFixed?.(1) ?? o.average}%`);
  }
  push("上涨年", o.positiveYears, "rise");
  push("下跌年", o.negativeYears, "fall");
  push("最近年", o.latestYear);

  if (o.latest && typeof o.latest === "object") {
    const latest = o.latest as Record<string, unknown>;
    for (const [k, v] of Object.entries(latest).slice(0, 3)) {
      if (/^(date|year|day|time)$/i.test(k)) continue;
      if (typeof v === "boolean" || v === "true" || v === "false") continue;
      if (typeof v === "string" && v.length > 24) continue;
      push(LATEST_KEY_ZH[k.toLowerCase()] ?? k, v);
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

  return rows.slice(0, 6);
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
  const ch = parseChapter(panel.chapter);
  const short = panelShortTitle(panel);
  const caption = PANEL_ZH[panel.id]?.q;
  const note = PANEL_ZH[panel.id]?.h;

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-20 pb-28">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/chronicle"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            编年史
          </Link>
          {ch.roman ? (
            <span className="font-mono text-[11px] text-slate-600">
              {ch.roman}. {ch.titleZh}
            </span>
          ) : null}
        </div>

        {/* 标题极简 —— 图在先 */}
        <header className="mb-5 animate-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{short}</h1>
          <p className="mt-1 text-xs text-slate-600">{panel.title}</p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rise/30 bg-rise/10 p-4 text-sm text-rise">
            数据加载失败：{error}
          </div>
        ) : (
          <ChronicleVisual id={panel.id} data={data} />
        )}

        {stats.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-y border-white/[0.06] py-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                  {s.label}
                </div>
                <div
                  className={`num mt-0.5 text-sm font-semibold ${
                    s.tone === "rise"
                      ? "text-rise"
                      : s.tone === "fall"
                        ? "text-fall"
                        : "text-slate-200"
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {caption ? (
          <p className="mt-5 max-w-2xl text-sm text-slate-500 leading-relaxed">{caption}</p>
        ) : null}

        {note ? (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs text-gold/80 hover:text-gold list-none [&::-webkit-details-marker]:hidden">
              要点速览 ▸
            </summary>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed border-l border-gold/25 pl-3">
              {note}
            </p>
          </details>
        ) : null}

        <div className="mt-6">
          <Link
            href={`/api/chronicle/${rel}`}
            className="text-[11px] text-slate-600 hover:text-slate-400"
          >
            JSON API
          </Link>
        </div>

        <div className="mt-10 flex justify-between gap-4 text-sm border-t border-white/10 pt-6">
          {prev ? (
            <Link
              href={`/chronicle/${encodeURIComponent(prev.id)}`}
              className="text-slate-500 hover:text-gold transition-colors max-w-[45%]"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Prev</div>
              <div className="mt-0.5 truncate">{panelShortTitle(prev)}</div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/chronicle/${encodeURIComponent(next.id)}`}
              className="text-right text-slate-500 hover:text-gold transition-colors max-w-[45%] ml-auto"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-600">Next</div>
              <div className="mt-0.5 truncate">{panelShortTitle(next)}</div>
            </Link>
          ) : null}
        </div>

        <footer className="mt-8 text-[11px] text-slate-600">
          数据来源：History of Market（CC-BY-4.0）
          {meta.synced_at ? ` · 同步于 ${meta.synced_at.slice(0, 10)}` : ""}
        </footer>
      </div>
    </div>
  );
}
