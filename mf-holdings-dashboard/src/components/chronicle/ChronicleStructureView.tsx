"use client";

import type { ReactNode } from "react";

type AnyRec = Record<string, unknown>;

/** 叙事 / 名单类面板的视觉卡（无时间序列时仍有画面） */
export function ChronicleStructureView({
  data,
  compact = false,
}: {
  data: unknown;
  compact?: boolean;
}): ReactNode {
  if (!data || typeof data !== "object") return null;
  const o = data as AnyRec;

  if (Array.isArray(o.casualties) || Array.isArray(o.survivors)) {
    const rows: (AnyRec & { side: "fall" | "rise" })[] = [
      ...((o.casualties as AnyRec[]) || []).map((r) => ({ ...r, side: "fall" as const })),
      ...((o.survivors as AnyRec[]) || []).map((r) => ({ ...r, side: "rise" as const })),
    ];
    return (
      <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 sm:grid-cols-2"}`}>
        {rows.slice(0, compact ? 10 : 20).map((r) => {
          const peak = Number(r.peak);
          const trough = Number(r.trough);
          const dd =
            Number.isFinite(peak) && peak !== 0 && Number.isFinite(trough)
              ? ((trough / peak - 1) * 100).toFixed(0)
              : null;
          return (
            <div
              key={String(r.ticker)}
              className="rounded-xl border border-white/[0.07] bg-navy-elevated/50 px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-gold">{String(r.ticker)}</span>
                {dd != null ? (
                  <span className={`num text-sm ${r.side === "fall" ? "text-fall" : "text-rise"}`}>
                    {dd}%
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 truncate">{String(r.name || "")}</div>
              {!compact && r.fate_cn ? (
                <div className="mt-1 text-[10px] text-slate-600 line-clamp-2">{String(r.fate_cn)}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (Array.isArray(o.moved_out) || Array.isArray(o.moved_in) || Array.isArray(o.stayed_in)) {
    const out = (o.moved_out as AnyRec[]) || [];
    const inn = (o.moved_in as AnyRec[]) || [];
    const stay = (o.stayed_in as AnyRec[]) || [];
    return (
      <div className={`grid gap-3 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {out.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">迁出</div>
            <div className="flex flex-wrap gap-1.5">
              {out.map((r) => (
                <span key={String(r.ticker)} className="badge badge-red font-mono text-[11px]">
                  {String(r.ticker)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {inn.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">迁入</div>
            <div className="flex flex-wrap gap-1.5">
              {inn.map((r) => (
                <span key={String(r.ticker)} className="badge badge-green font-mono text-[11px]">
                  {String(r.ticker)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {stay.length ? (
          <div className={out.length || inn.length ? "sm:col-span-2" : ""}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">留存</div>
            <div className="flex flex-wrap gap-1.5">
              {stay.map((r) => (
                <span key={String(r.ticker)} className="badge badge-gold font-mono text-[11px]">
                  {String(r.ticker)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!compact && (o.summary_cn || o.implication_cn) ? (
          <p className="sm:col-span-2 text-xs text-slate-500 leading-relaxed line-clamp-4">
            {String(o.summary_cn || o.implication_cn)}
          </p>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(o.generations)) {
    const gens = o.generations as AnyRec[];
    return (
      <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {gens.map((g) => (
          <div
            key={String(g.id)}
            className="rounded-xl border border-white/[0.07] bg-navy-elevated/50 px-3 py-3"
          >
            <div className="font-display text-sm text-gold-light">
              {String(g.label_cn || g.label_en || g.id)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">
              {String(g.era || g.peakYear || "")}
              {g.peakWeight != null ? ` · ${g.peakWeight}%` : ""}
            </div>
            {Array.isArray(g.members) ? (
              <div className="mt-2 text-[10px] text-slate-600 line-clamp-3 leading-relaxed">
                {(g.members as unknown[]).slice(0, 8).map(String).join(" · ")}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(o.subsectors) && o.subsectors[0] && "tickers" in (o.subsectors[0] as AnyRec)) {
    const subs = o.subsectors as AnyRec[];
    return (
      <div className="space-y-2">
        {subs.map((s) => (
          <div key={String(s.id)} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-slate-400 truncate">
              {String(s.name_cn || s.name_en || s.id)}
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gold/70"
                style={{
                  width: `${Math.min(100, (Number(s.count) / 30) * 100)}%`,
                }}
              />
            </div>
            <div className="font-mono text-[11px] text-slate-500 w-6 text-right">
              {String(s.count ?? "")}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function hasStructureVisual(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as AnyRec;
  return Boolean(
    o.casualties ||
      o.survivors ||
      o.moved_out ||
      o.moved_in ||
      o.stayed_in ||
      o.generations ||
      (Array.isArray(o.subsectors) &&
        o.subsectors[0] &&
        typeof o.subsectors[0] === "object" &&
        "tickers" in (o.subsectors[0] as AnyRec))
  );
}
