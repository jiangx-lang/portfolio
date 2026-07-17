"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  Search,
  X,
} from "lucide-react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { trackAnalytics } from "@/lib/analytics-client";
import { awardContentRead } from "@/lib/track-xp";
import PdfReaderModal from "@/components/PdfReaderModal";

export type DailyReportRow = {
  id: number;
  title: string;
  date: string;
  file_url: string;
  created_at?: string;
};

export type MarketNoteRow = {
  id: number;
  title: string;
  content: string;
  date: string;
  created_at?: string;
};

type ReaderState = {
  url: string;
  title: string;
  date?: string;
} | null;

/* ---------- 日期工具 ---------- */

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

/* ---------- 搜索片段高亮 ---------- */

function SearchSnippet({ content, query }: { content: string; query: string }) {
  const idx = content.toLowerCase().indexOf(query);
  if (idx < 0) return null;
  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + query.length + 30);
  return (
    <p className="mb-3 text-xs leading-relaxed text-slate-500">
      {start > 0 && "…"}
      {content.slice(start, idx)}
      <mark className="rounded bg-gold/20 px-0.5 text-gold-light">
        {content.slice(idx, idx + query.length)}
      </mark>
      {content.slice(idx + query.length, end)}
      {end < content.length && "…"}
    </p>
  );
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

/* ---------- 市场笔记卡片 ---------- */

function TrackedNoteCard({ note, query }: { note: MarketNoteRow; query: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const content = note.content || "";
  const collapsible = content.length > 500;
  const minutes = Math.max(1, Math.round(content.length / 400));
  const rel = relativeLabel(note.date);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const obs = new IntersectionObserver(
      (entries) => {
        if (done) return;
        const e = entries[0];
        if (e?.isIntersecting) {
          done = true;
          trackAnalytics({
            event_type: "content",
            page_path: "/notes",
            content_type: "market_note",
            content_id: note.id,
          });
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [note.id]);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) awardContentRead("market_note", note.id);
      return next;
    });
  };

  return (
    <div ref={ref} className="glass-card animate-in mb-4 p-6">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-slate-500">{note.date}</span>
        {rel && <span className="text-slate-600">{rel}</span>}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-slate-500">
          <Clock className="h-3 w-3" />
          约 {minutes} 分钟
        </span>
      </div>
      <h3 className="font-display mt-2 mb-3 text-xl font-bold text-slate-50">
        {note.title}
      </h3>
      {query && <SearchSnippet content={content} query={query} />}
      <div
        className={
          collapsible && !expanded ? "relative max-h-[260px] overflow-hidden" : "relative"
        }
      >
        <div className="markdown-notes">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {collapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-navy-card to-transparent" />
        )}
      </div>
      {collapsible && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={toggleExpanded}
            className="btn-ghost !px-4 !py-1.5 text-xs"
          >
            {expanded ? "收起" : "展开全文"}
            <ChevronDown
              className={
                expanded
                  ? "h-3.5 w-3.5 rotate-180 transition-transform"
                  : "h-3.5 w-3.5 transition-transform"
              }
            />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- 空态 ---------- */

function EmptyState({ searching }: { searching: boolean }) {
  if (searching) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
        <Search className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">未找到相关内容</p>
      </div>
    );
  }
  return <p className="text-sm text-slate-500">暂无内容</p>;
}

/* ---------- 页面 ---------- */

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6">
          <p className="pt-16 text-center text-sm text-slate-500">加载中…</p>
        </div>
      }
    >
      <NotesPageInner />
    </Suspense>
  );
}

function NotesPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"reports" | "notes">("reports");
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [notes, setNotes] = useState<MarketNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [reader, setReader] = useState<ReaderState>(null);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "notes") setTab("notes");
    else if (t === "reports") setTab("reports");
  }, [searchParams]);

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
    void Promise.all([
      supabase
        .from("daily_reports")
        .select("id,title,date,file_url,created_at")
        .order("date", { ascending: false }),
      supabase
        .from("market_notes")
        .select("id,title,content,date,created_at")
        .order("date", { ascending: false }),
    ]).then(([r1, r2]) => {
      const parts: string[] = [];
      if (r1.error) parts.push(`每日报告: ${r1.error.message}`);
      if (r2.error) parts.push(`市场笔记: ${r2.error.message}`);
      if (parts.length) setErr(parts.join("；"));
      setReports((r1.data as DailyReportRow[]) ?? []);
      setNotes((r2.data as MarketNoteRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const q = search.trim().toLowerCase();
  const filteredReports = reports.filter((r) =>
    (r.title || "").toLowerCase().includes(q)
  );
  const filteredNotes = notes.filter(
    (n) =>
      (n.title || "").toLowerCase().includes(q) ||
      (n.content || "").toLowerCase().includes(q)
  );

  const reportGroups = groupByMonth(filteredReports.slice(1));
  const noteGroups = groupByMonth(filteredNotes);
  const heroReport = filteredReports[0];
  const resultCount = tab === "reports" ? filteredReports.length : filteredNotes.length;

  /** 桌面端打开站内阅读器，移动端直接新窗口；同时发放 XP 并保留原埋点 */
  const openReport = (r: DailyReportRow) => {
    trackAnalytics({
      event_type: "content",
      page_path: "/notes",
      content_type: "daily_report",
      content_id: r.id,
    });
    awardContentRead("daily_report", r.id);
    if (window.matchMedia("(max-width: 768px)").matches) {
      window.open(r.file_url, "_blank", "noopener,noreferrer");
    } else {
      setReader({ url: r.file_url, title: r.title, date: r.date });
    }
  };

  const tabs = [
    { key: "reports" as const, label: "每日报告", icon: FileText, count: reports.length },
    { key: "notes" as const, label: "市场笔记", icon: BookOpen, count: notes.length },
  ];

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
          <span className="eyebrow">MARKET INTELLIGENCE</span>
          <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
            市场资讯
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            每日报告 · 市场笔记 · 仅供参考
          </p>
        </header>

        <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.04] p-1">
          {tabs.map(({ key, label, icon: Icon, count }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-semibold text-navy transition"
                    : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-400 transition hover:text-slate-100"
                }
              >
                <Icon className="h-4 w-4" />
                {label}
                <span className="font-mono text-xs opacity-75">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="搜索标题或正文…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] py-2.5 pl-10 pr-24 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-gold/40"
          />
          {q && (
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {resultCount} 篇
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
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        )}
        {err && !loading && <p className="badge badge-red mb-4">{err}</p>}

        {tab === "reports" && !loading && (
          <>
            {filteredReports.length === 0 ? (
              <EmptyState searching={!!q} />
            ) : (
              <>
                {heroReport && (
                  <div className="glass-card glow-border animate-in relative mb-8 p-6 sm:p-7">
                    <span className="badge badge-gold absolute right-4 top-4">最新</span>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
                        <FileText className="h-7 w-7 text-gold" />
                      </div>
                      <div className="min-w-0 flex-1 sm:pr-10">
                        <div className="font-mono text-xs text-slate-500">
                          {heroReport.date}
                        </div>
                        <h3 className="font-display mt-1.5 text-xl font-bold leading-snug text-slate-50 sm:text-2xl">
                          {heroReport.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReport(heroReport)}
                        className="btn-gold shrink-0"
                      >
                        阅读报告
                        <BookOpen className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {reportGroups.map(([month, items]) => (
                  <div key={month}>
                    <MonthGroupHeader label={month} />
                    {items.map((r) => (
                      <div
                        key={r.id}
                        className="glass-card animate-in mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="shrink-0 font-mono text-xs text-slate-500">
                          {r.date}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">
                          {r.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-2.5">
                          {isRecent(r.date) && (
                            <span className="badge badge-gold">NEW</span>
                          )}
                          <button
                            type="button"
                            onClick={() => openReport(r)}
                            className="btn-ghost whitespace-nowrap !px-4 !py-1.5 text-xs"
                          >
                            阅读
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "notes" && !loading && (
          <>
            {filteredNotes.length === 0 ? (
              <EmptyState searching={!!q} />
            ) : (
              noteGroups.map(([month, items]) => (
                <div key={month}>
                  <MonthGroupHeader label={month} />
                  {items.map((n) => (
                    <TrackedNoteCard key={n.id} note={n} query={q} />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {reader && (
          <PdfReaderModal
            url={reader.url}
            title={reader.title}
            date={reader.date}
            onClose={() => setReader(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
