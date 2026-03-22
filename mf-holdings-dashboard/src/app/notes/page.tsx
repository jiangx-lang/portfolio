"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { trackAnalytics } from "@/lib/analytics-client";
import PasswordGate from "@/components/PasswordGate";

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

function TrackedNoteCard({
  note,
  cardStyle,
}: {
  note: MarketNoteRow;
  cardStyle: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
  return (
    <div ref={ref} style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: "12px" }}>{note.date}</div>
      <h3 style={{ color: "#e2e8f0", margin: "8px 0" }}>{note.title}</h3>
      <div
        style={{
          color: "#cbd5e1",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
        className="markdown-notes"
      >
        <ReactMarkdown>{note.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <PasswordGate title="市场资讯">
      <NotesPageInner />
    </PasswordGate>
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

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0f1e",
      color: "#e2e8f0",
      padding: "40px 24px",
    },
    tab: (active: boolean) =>
      ({
        background: active ? "#1e3a5f" : "transparent",
        color: active ? "#60a5fa" : "#64748b",
        border: "1px solid #1e3a5f",
        borderRadius: "8px",
        padding: "8px 20px",
        cursor: "pointer",
        marginRight: "8px",
        fontSize: "14px",
        fontFamily: "inherit",
      }) as CSSProperties,
    card: {
      background: "#0d1b2e",
      border: "1px solid #1e3a5f",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "12px",
    },
    input: {
      width: "100%",
      background: "#0f2744",
      color: "#e2e8f0",
      border: "1px solid #1e3a5f",
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "14px",
      marginBottom: "20px",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
    },
    pdfBtn: {
      background: "#0f2744",
      color: "#60a5fa",
      border: "1px solid #3b82f6",
      borderRadius: "8px",
      padding: "6px 14px",
      fontSize: "13px",
      textDecoration: "none",
      display: "inline-block",
      whiteSpace: "nowrap" as const,
    },
  };

  const q = search.trim().toLowerCase();
  const filteredReports = reports.filter((r) =>
    (r.title || "").toLowerCase().includes(q)
  );
  const filteredNotes = notes.filter((n) =>
    (n.title || "").toLowerCase().includes(q)
  );

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <Link href="/" style={{ color: "#64748b", fontSize: "13px", textDecoration: "none" }}>
          ← 返回首页
        </Link>
        <h1 style={{ color: "#e2e8f0", margin: "16px 0 8px" }}>📚 市场资讯</h1>
        <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>
          每日报告 · 市场笔记 · 仅供参考
        </p>

        <div style={{ marginBottom: "20px" }}>
          <button
            type="button"
            style={s.tab(tab === "reports")}
            onClick={() => setTab("reports")}
          >
            📄 每日报告 ({reports.length})
          </button>
          <button
            type="button"
            style={s.tab(tab === "notes")}
            onClick={() => setTab("notes")}
          >
            📝 市场笔记 ({notes.length})
          </button>
        </div>

        <input
          placeholder="搜索标题…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.input}
        />

        {loading && <p style={{ color: "#64748b" }}>加载中...</p>}
        {err && !loading && (
          <p style={{ color: "#f87171", fontSize: 14, marginBottom: 16 }}>{err}</p>
        )}

        {tab === "reports" && !loading && (
          <>
            {filteredReports.length === 0 ? (
              <p style={{ color: "#64748b" }}>暂无报告</p>
            ) : (
              filteredReports.map((r) => (
                <div
                  key={r.id}
                  style={{
                    ...s.card,
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div style={{ fontSize: "28px" }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>{r.date}</div>
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontSize: "14px",
                        fontWeight: 500,
                        marginTop: "4px",
                      }}
                    >
                      {r.title}
                    </div>
                  </div>
                  <a
                    href={r.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.pdfBtn}
                    onClick={() =>
                      trackAnalytics({
                        event_type: "content",
                        page_path: "/notes",
                        content_type: "daily_report",
                        content_id: r.id,
                      })
                    }
                  >
                    查看 PDF →
                  </a>
                </div>
              ))
            )}
          </>
        )}

        {tab === "notes" && !loading && (
          <>
            {filteredNotes.length === 0 ? (
              <p style={{ color: "#64748b" }}>暂无笔记</p>
            ) : (
              filteredNotes.map((n) => (
                <TrackedNoteCard key={n.id} note={n} cardStyle={s.card} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
