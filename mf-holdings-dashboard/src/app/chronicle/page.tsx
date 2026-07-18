import Link from "next/link";
import { BookOpen, RefreshCw } from "lucide-react";
import { ChronicleHubClient } from "@/components/chronicle/ChronicleHubClient";
import { TodayStrip } from "@/components/chronicle/TodayStrip";
import { getSyncMeta, loadProfilePanels } from "@/lib/chronicle/load";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "美股编年史 · ATLAS",
  description:
    "站内镜像 History of Market：百年美股回报、估值、回撤与结构演变（CC-BY-4.0，日更同源）",
};

export default async function ChronicleHubPage() {
  const panels = await loadProfilePanels();
  const meta = getSyncMeta();

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-28">
        <header className="relative mb-10 max-w-3xl animate-in">
          <div
            aria-hidden
            className="hero-glow pointer-events-none absolute -top-32 -left-48 -z-10 h-[380px] w-[680px] rounded-full opacity-70"
          />
          <span className="eyebrow">US MARKET CHRONICLE</span>
          <h1 className="font-display text-balance text-4xl sm:text-6xl font-bold mt-3 text-gradient-gold">
            美股编年史
          </h1>
          <div className="ornament mt-5 max-w-[200px]">
            <span className="text-[10px]">✦</span>
          </div>
          <p className="text-sm sm:text-base text-slate-400 mt-5 leading-relaxed">
            以研究叙事组织百年美股：回报形状、估值锚点、危机节奏与指数解剖。数据与{" "}
            <span className="text-slate-300">History of Market</span> 同源公开
            JSON，{panels.length} 个章节面板，按 CC-BY-4.0 署名使用。
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="badge badge-gold">
              <BookOpen className="h-3 w-3" />
              {panels.length} 面板
            </span>
            <span className={`badge ${meta.stale ? "badge-red" : "badge-green"}`}>
              <RefreshCw className="h-3 w-3" />
              {meta.synced_at
                ? meta.stale
                  ? `镜像偏旧 · ${meta.age_hours ?? "?"}h · 已回源官网`
                  : `已同步 · ${meta.age_hours ?? 0}h 前`
                : "实时回源官网"}
            </span>
            <span className="badge badge-blue">每个交易日更新</span>
          </div>
        </header>

        <TodayStrip />

        <ChronicleHubClient panels={panels} />

        <footer className="mt-14 border-t border-white/10 pt-6 text-xs leading-relaxed text-slate-600">
          数据与图表来源：History of Market · 美股编年史（CC-BY-4.0 署名使用）。
          本站每个交易日自动同步公开数据；若本地镜像超过约 26
          小时，页面自动回源获取最新 JSON。本页为研究镜像，不构成投资建议。
        </footer>
      </div>
    </div>
  );
}
