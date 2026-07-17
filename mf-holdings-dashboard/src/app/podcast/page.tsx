"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Podcast, Search, X } from "lucide-react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { trackAnalytics } from "@/lib/analytics-client";
import { awardContentRead } from "@/lib/track-xp";
import AudioPlayer from "@/components/AudioPlayer";

export type PodcastRow = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  audio_url: string | null;
  created_at?: string;
};

/* ---------- 日期工具（与 notes 页同款） ---------- */

function parseDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateStr || "");
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(dateStr: string): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

function relativeLabel(dateStr: string): string {
  const days = daysSince(dateStr);
  if (days === null) return "";
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

function isRecent(dateStr: string): boolean {
  const days = daysSince(dateStr);
  return days !== null && days >= 0 && days <= 3;
}

function monthLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return "其他";
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** 输入已按日期倒序，按月份顺序归组 */
function groupByMonth<T extends { date: string }>(items: T[]): Array<[string, T[]]> {
  const groups: Array<[string, T[]]> = [];
  for (const item of items) {
    const key = monthLabel(item.date);
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(item);
    else groups.push([key, [item]]);
  }
  return groups;
}

/* ---------- 月份分组标题 ---------- */

function MonthGroupHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 mt-8 flex items-center gap-4 first:mt-0">
      <span className="eyebrow shrink-0">{label}</span>
      <hr className="hairline-gold flex-1" />
    </div>
  );
}

/* ---------- 页面 ---------- */

export default function PodcastPage() {
  return <PodcastPageInner />;
}

function PodcastPageInner() {
  const [pods, setPods] = useState<PodcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isBrowserSupabaseConfigured()) {
      setLoading(false);
      setErr("未配置 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setErr("无法初始化 Supabase 客户端");
      return;
    }
    void supabase
      .from("podcasts")
      .select("id,title,description,date,audio_url,created_at")
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setPods((data as PodcastRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  /** 播放埋点（保持原参数）+ XP 奖励（会话内去重） */
  const handlePlay = (pod: PodcastRow) => {
    trackAnalytics({
      event_type: "content",
      page_path: "/podcast",
      content_type: "podcast",
      content_id: pod.id,
    });
    awardContentRead("podcast", pod.id, "/podcast");
  };

  const q = search.trim().toLowerCase();
  const filteredPods = pods.filter(
    (p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
  );
  const visiblePods = filteredPods.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredPods.length;

  const heroPod = q ? null : (visiblePods[0] ?? null);
  const restPods = q ? filteredPods : visiblePods.slice(1);
  const restGroups = q ? [] : groupByMonth(restPods);

  const renderPlayer = (pod: PodcastRow) =>
    pod.audio_url ? (
      <AudioPlayer
        id={pod.id}
        src={pod.audio_url}
        downloadUrl={pod.audio_url}
        onPlay={() => handlePlay(pod)}
      />
    ) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-gold-light"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </Link>
        </div>

        <header className="mb-8">
          <span className="eyebrow">ATLAS PODCAST</span>
          <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
            播客
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            投研音频解读 · 随时随地收听市场观点
          </p>
        </header>

        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="搜索标题或简介…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 pl-10 pr-24 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-gold/40"
          />
          {q && (
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {filteredPods.length} 集
              </span>
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="清空搜索"
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="skeleton h-40 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        )}
        {err && !loading && <p className="badge badge-red mb-4">{err}</p>}
        {!loading && !err && pods.length === 0 && (
          <p className="text-sm text-slate-500">暂无播客</p>
        )}
        {!loading && !err && pods.length > 0 && filteredPods.length === 0 && (
          <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
            <Search className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">未找到相关播客</p>
          </div>
        )}

        {!loading && heroPod && (
          <div className="glass-card glow-border animate-in relative mb-8 p-6 sm:p-7">
            <span className="badge badge-gold absolute right-4 top-4">最新</span>
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
                <Podcast className="h-7 w-7 text-gold" />
              </div>
              <div className="min-w-0 flex-1 pr-10">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-500">{heroPod.date}</span>
                  {relativeLabel(heroPod.date) && (
                    <span className="text-slate-600">{relativeLabel(heroPod.date)}</span>
                  )}
                </div>
                <h3 className="font-display mt-1.5 text-xl font-bold leading-snug text-slate-50 sm:text-2xl">
                  {heroPod.title}
                </h3>
                {heroPod.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-400 line-clamp-3">
                    {heroPod.description}
                  </p>
                )}
              </div>
            </div>
            {heroPod.audio_url && <div className="mt-5">{renderPlayer(heroPod)}</div>}
          </div>
        )}

        {!loading && q &&
          restPods.map((pod) => (
            <div key={pod.id} className="glass-card animate-in mb-3 p-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-500">{pod.date}</span>
                {relativeLabel(pod.date) && (
                  <span className="text-slate-600">{relativeLabel(pod.date)}</span>
                )}
                {isRecent(pod.date) && (
                  <span className="badge badge-gold ml-auto">NEW</span>
                )}
              </div>
              <h3 className="font-display mt-1.5 text-base font-bold text-slate-50">
                {pod.title}
              </h3>
              {pod.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400 line-clamp-2">
                  {pod.description}
                </p>
              )}
              {pod.audio_url && <div className="mt-3">{renderPlayer(pod)}</div>}
            </div>
          ))}

        {!loading &&
          !q &&
          restGroups.map(([month, items]) => (
            <div key={month}>
              <MonthGroupHeader label={month} />
              {items.map((pod) => (
                <div key={pod.id} className="glass-card animate-in mb-3 p-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-500">{pod.date}</span>
                    {relativeLabel(pod.date) && (
                      <span className="text-slate-600">{relativeLabel(pod.date)}</span>
                    )}
                    {isRecent(pod.date) && (
                      <span className="badge badge-gold ml-auto">NEW</span>
                    )}
                  </div>
                  <h3 className="font-display mt-1.5 text-base font-bold text-slate-50">
                    {pod.title}
                  </h3>
                  {pod.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400 line-clamp-2">
                      {pod.description}
                    </p>
                  )}
                  {pod.audio_url && <div className="mt-3">{renderPlayer(pod)}</div>}
                </div>
              ))}
            </div>
          ))}

        {!loading && !err && !q && canLoadMore && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((n) => Math.min(n + 10, filteredPods.length))
              }
              className="btn-ghost"
            >
              加载更多
              <span className="font-mono text-xs opacity-70">
                {visiblePods.length}/{filteredPods.length}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
