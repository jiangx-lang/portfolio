import { getSyncMeta, loadPanelDataset, loadProfilePanels } from "@/lib/chronicle/load";
import { coverStatsFromAnnual } from "@/lib/chronicle/magazine";
import { ChronicleHubClient } from "@/components/chronicle/ChronicleHubClient";
import { TodayStrip } from "@/components/chronicle/TodayStrip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "美股编年史 · ATLAS",
  description:
    "站内镜像 History of Market：百年美股回报、估值、回撤与结构演变（CC-BY-4.0，日更同源）",
};

export default async function ChronicleHubPage() {
  const panels = await loadProfilePanels();
  const meta = getSyncMeta();
  const annualPanel = panels.find((p) => p.id === "annual");
  let cover = coverStatsFromAnnual(undefined);
  if (annualPanel) {
    try {
      cover = coverStatsFromAnnual(await loadPanelDataset(annualPanel));
    } catch {
      /* 封面数字可选 */
    }
  }

  const vol = String(panels.length).padStart(2, "0");
  const editionDate = cover.updated || meta.synced_at?.slice(0, 10) || "—";

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-28">
        {/* 报头式 masthead —— 少字、重版式 */}
        <header className="relative mb-8 animate-in">
          <div
            aria-hidden
            className="hero-glow pointer-events-none absolute -top-28 -left-40 -z-10 h-[320px] w-[560px] rounded-full opacity-60"
          />
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 tracking-[0.14em] uppercase">
                <span>Vol. {vol}</span>
                <span className="text-slate-700">·</span>
                <span>{editionDate}</span>
                <span className="text-slate-700">·</span>
                <span className={meta.stale ? "text-rise" : "text-fall"}>
                  {meta.stale ? "live feed" : "synced"}
                </span>
              </div>
              <h1 className="font-display text-balance text-4xl sm:text-5xl font-bold mt-3 text-gradient-gold tracking-tight">
                美股编年史
              </h1>
            </div>
            <p className="max-w-xs text-right text-[11px] leading-relaxed text-slate-600">
              History of Market · CC-BY-4.0
              <br />
              {panels.length} panels · chart-first
            </p>
          </div>
        </header>

        <ChronicleHubClient panels={panels} cover={cover} today={<TodayStrip />} />
        <footer className="mt-16 border-t border-white/10 pt-5 text-[11px] leading-relaxed text-slate-600">
          数据来源：History of Market（CC-BY-4.0）。本站每日同步镜像，过期自动回源更新。仅供研究，不构成投资建议。
        </footer>
      </div>
    </div>
  );
}
