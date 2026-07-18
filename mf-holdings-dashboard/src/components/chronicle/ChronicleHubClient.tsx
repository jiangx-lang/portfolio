"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChroniclePanelPreview } from "@/components/chronicle/ChroniclePanelPreview";
import {
  buildMagazineSections,
  panelShortTitle,
  type CoverStats,
} from "@/lib/chronicle/magazine";
import type { ChronicleCategory, ChroniclePanel } from "@/lib/chronicle/types";

export function ChronicleHubClient({
  panels,
  cover,
  today,
}: {
  panels: ChroniclePanel[];
  cover?: CoverStats;
  today?: ReactNode;
}) {
  const sections = useMemo(() => buildMagazineSections(panels), [panels]);
  const [active, setActive] = useState<ChronicleCategory>(
    sections[0]?.category ?? "sp500"
  );

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(`sec-${s.category}`))
      .filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target?.id?.replace(/^sec-/, "") as
          | ChronicleCategory
          | undefined;
        if (id) setActive(id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [sections]);

  const activeSection = sections.find((s) => s.category === active) || sections[0];

  const scrollTo = (cat: ChronicleCategory) => {
    const el = document.getElementById(`sec-${cat}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8">
      {/* § 章节轨 —— 对齐 HoM */}
      <nav
        aria-label="编年史章节"
        className="sticky top-14 z-20 -mx-1 border-y border-white/[0.06] bg-navy/92 backdrop-blur-xl"
      >
        <div className="flex gap-1 overflow-x-auto px-1 py-2.5 min-w-max">
          {sections.map((s) => (
            <button
              key={s.category}
              type="button"
              onClick={() => scrollTo(s.category)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium tracking-wide transition ${
                active === s.category
                  ? "bg-gold/15 text-gold border border-gold/35"
                  : "border border-transparent text-slate-500 hover:text-slate-200"
              }`}
            >
              <span className="font-mono text-[10px] opacity-70">§ {s.roman}</span>{" "}
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {today}

      {/* 封面短文 —— 两栏 + 大数字，不用长段卡片 */}
      <section className="animate-in border-b border-white/[0.06] pb-10">
        <h2 className="font-display text-2xl sm:text-3xl text-white text-balance leading-snug">
          百年美股 ——{" "}
          <em className="not-italic text-gold-light">对数坐标上的一条长线</em>
        </h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 text-sm text-slate-400 leading-relaxed">
          <p>
            回报从来不是一条直线。把年度涨跌、估值锚点与危机节奏放进同一页，复利的形状才会浮现。
          </p>
          <p>
            以下按卷展开：每章一张旗舰图，其余条目收入目录。图为主，字为辅。
          </p>
        </div>
        {(cover?.compound || cover?.latest || cover?.sample) && (
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/[0.06] pt-6">
            {cover.compound ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Compound
                </div>
                <div className="num mt-1 text-xl text-gold">{cover.compound}</div>
              </div>
            ) : null}
            {cover.latest ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Latest year
                </div>
                <div className="num mt-1 text-xl text-slate-100">{cover.latest}</div>
              </div>
            ) : null}
            {cover.sample ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Sample
                </div>
                <div className="num mt-1 text-xl text-slate-100">{cover.sample}</div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-16 min-w-0">
          {sections.map((sec) => (
            <section
              key={sec.category}
              id={`sec-${sec.category}`}
              className="scroll-mt-28"
            >
              <header className="mb-8 flex items-baseline gap-3">
                <span className="font-mono text-sm text-gold/80">§ {sec.roman}</span>
                <h2 className="font-display text-2xl sm:text-3xl text-white">
                  {sec.label}
                </h2>
                <span className="text-xs text-slate-600 tracking-wide">
                  {sec.labelEn}
                </span>
              </header>

              <div className="space-y-14">
                {sec.chapters.map((ch) => {
                  const fp = ch.flagship;
                  const short = panelShortTitle(fp);
                  return (
                    <article key={ch.key} id={`ch-${fp.id}`} className="scroll-mt-28">
                      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {ch.parsed.roman ? (
                          <span className="font-mono text-xs text-slate-500">
                            {ch.parsed.roman}.
                          </span>
                        ) : null}
                        <h3 className="font-display text-lg sm:text-xl text-gold-light">
                          {ch.parsed.titleZh || short}
                        </h3>
                        {ch.parsed.titleEn && ch.parsed.titleZh !== ch.parsed.titleEn ? (
                          <span className="text-[11px] text-slate-600 italic">
                            {ch.parsed.titleEn}
                          </span>
                        ) : null}
                      </div>

                      <Link
                        href={`/chronicle/${encodeURIComponent(fp.id)}`}
                        className="group block rounded-2xl border border-white/[0.07] bg-navy-card/60 p-3 sm:p-4 transition hover:border-gold/30"
                      >
                        <ChroniclePanelPreview panel={fp} height={300} />
                        <div className="mt-3 flex items-end justify-between gap-3 px-1">
                          <div>
                            <div className="text-sm font-medium text-slate-100 group-hover:text-gold transition-colors">
                              {short}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">
                              {fp.title}
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] text-gold/80 opacity-0 transition group-hover:opacity-100">
                            展开 →
                          </span>
                        </div>
                      </Link>

                      {ch.rest.length > 0 ? (
                        <ol className="mt-4 space-y-0 border-l border-white/[0.06] pl-4">
                          {ch.rest.map((p, i) => (
                            <li key={p.id}>
                              <Link
                                href={`/chronicle/${encodeURIComponent(p.id)}`}
                                className="group flex items-baseline gap-3 py-1.5 text-sm text-slate-500 hover:text-gold transition-colors"
                              >
                                <span className="font-mono text-[10px] text-slate-600 w-5 shrink-0">
                                  {String(i + 2).padStart(2, "0")}
                                </span>
                                <span className="truncate">{panelShortTitle(p)}</span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* 侧栏目录 —— 短标题，无段落 */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-600 mb-3">
              Contents
            </div>
            {activeSection ? (
              <div className="space-y-5">
                {activeSection.chapters.map((ch) => (
                  <div key={ch.key}>
                    <div className="font-mono text-[10px] text-gold/70 mb-1.5">
                      {ch.parsed.roman
                        ? `${ch.parsed.roman}. ${ch.parsed.titleZh}`
                        : ch.parsed.titleZh}
                    </div>
                    <ul className="space-y-1">
                      {ch.all.map((p) => (
                        <li key={p.id}>
                          {p.id === ch.flagship.id ? (
                            <button
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById(`ch-${p.id}`)
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
                              }
                              className="block w-full text-left text-[12px] leading-snug text-slate-400 hover:text-slate-100 truncate"
                            >
                              {panelShortTitle(p)}
                            </button>
                          ) : (
                            <Link
                              href={`/chronicle/${encodeURIComponent(p.id)}`}
                              className="block text-[12px] leading-snug text-slate-500 hover:text-slate-200 truncate"
                            >
                              {panelShortTitle(p)}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
