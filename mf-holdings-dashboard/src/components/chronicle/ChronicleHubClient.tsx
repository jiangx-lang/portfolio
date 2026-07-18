"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import {
  CATEGORY_META,
  inferCategory,
  type ChronicleCategory,
  type ChroniclePanel,
} from "@/lib/chronicle/types";
import { PANEL_ZH } from "@/lib/chronicle/zh";

const FEATURED_IDS = ["pe", "drawdown", "annual", "forward-pe", "ndx-drawdown", "mag7-concentration"];

export function ChronicleHubClient({
  panels,
}: {
  panels: ChroniclePanel[];
}) {
  const groups = useMemo(() => {
    const map = new Map<ChronicleCategory, ChroniclePanel[]>();
    for (const p of panels) {
      const cat = inferCategory(p);
      const list = map.get(cat);
      if (list) list.push(p);
      else map.set(cat, [p]);
    }
    return Array.from(map.entries()).sort(
      (a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order
    );
  }, [panels]);

  const [active, setActive] = useState<ChronicleCategory | "all">("all");

  const featured = useMemo(
    () =>
      FEATURED_IDS.map((id) => panels.find((p) => p.id === id)).filter(
        Boolean
      ) as ChroniclePanel[],
    [panels]
  );

  const visible = active === "all" ? groups : groups.filter(([c]) => c === active);

  return (
    <div className="space-y-10">
      {featured.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg text-gold-light">精选章节</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/chronicle/${encodeURIComponent(p.id)}`}
                className="glass-card group p-5 glow-border"
              >
                <div className="eyebrow mb-2">{p.chapter || inferCategory(p).toUpperCase()}</div>
                <div className="font-display text-lg text-white group-hover:text-gold transition-colors">
                  {p.title}
                </div>
                {PANEL_ZH[p.id]?.q ? (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2">{PANEL_ZH[p.id].q}</p>
                ) : null}
                <div className="mt-4 inline-flex items-center gap-1 text-sm text-gold">
                  阅读 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sticky top-14 z-20 -mx-1 overflow-x-auto bg-navy/90 backdrop-blur-xl py-3 px-1 border-y border-white/[0.06]">
        <div className="flex gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              active === "all"
                ? "bg-gold/20 text-gold border border-gold/40"
                : "border border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            全部 {panels.length}
          </button>
          {groups.map(([cat, list]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActive(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                active === cat
                  ? "bg-gold/20 text-gold border border-gold/40"
                  : "border border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {CATEGORY_META[cat].label} {list.length}
            </button>
          ))}
        </div>
      </div>

      {visible.map(([cat, list]) => (
        <section key={cat} id={`cat-${cat}`} className="scroll-mt-28">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-white">{CATEGORY_META[cat].label}</h2>
              <p className="text-xs text-slate-500 mt-1 tracking-wide">
                {CATEGORY_META[cat].labelEn}
              </p>
            </div>
            <span className="badge badge-gold">{list.length} 篇</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/chronicle/${encodeURIComponent(p.id)}`}
                className="glass-card group p-4"
              >
                {p.chapter ? <div className="eyebrow mb-1.5">{p.chapter}</div> : null}
                <div className="text-base font-semibold text-slate-100 group-hover:text-gold transition-colors">
                  {p.title}
                </div>
                {PANEL_ZH[p.id]?.q ? (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2">{PANEL_ZH[p.id].q}</p>
                ) : null}
                {PANEL_ZH[p.id]?.h ? (
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 border-t border-white/5 pt-2">
                    {PANEL_ZH[p.id].h}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
