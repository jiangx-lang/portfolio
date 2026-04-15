"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { formatDeviceCell } from "@/lib/parseUA";
import {
  formatLocationLine,
  formatOrgNote,
  isPrivateOrLocalIp,
  type IpApiFields,
} from "@/lib/ipGeoDisplay";
import { formatBeijingTime } from "@/lib/formatBeijingTime";

/** 仅前端门槛，会打进客户端包；生产请改服务端鉴权或服务_role API */
const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "atlas2024";

type AdminAnalyticsJson = {
  error?: string;
  recent: Array<{
    id: number;
    event_type: string;
    page_path: string;
    content_type: string | null;
    content_id: number | null;
    ip: string | null;
    user_agent: string | null;
    referrer: string | null;
    created_at: string;
  }>;
  summary: {
    last24h: number;
    last7d: number;
    byPath: [string, number][];
    contentReads: [string, number][];
  } | null;
};

const ADMIN_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

function statsEventBadge(eventType: string, contentType: string | null) {
  if (eventType === "page") {
    return {
      label: "页面",
      bg: "rgba(59,130,246,0.2)",
      color: "#93c5fd",
      border: "1px solid rgba(59,130,246,0.45)",
    };
  }
  if (contentType === "podcast") {
    return {
      label: "播放",
      bg: "rgba(168,85,247,0.2)",
      color: "#d8b4fe",
      border: "1px solid rgba(168,85,247,0.45)",
    };
  }
  return {
    label: "互动",
    bg: "rgba(34,197,94,0.18)",
    color: "#86efac",
    border: "1px solid rgba(34,197,94,0.4)",
  };
}

function IconEye() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.9 }}
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.9 }}
      aria-hidden
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function AdminStatHeroCards({ last24h, last7d }: { last24h: number; last7d: number }) {
  const cardShell = {
    borderRadius: 16,
    padding: "22px 24px",
    border: "1px solid rgba(147, 197, 253, 0.22)",
    position: "relative" as const,
    overflow: "hidden" as const,
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 16,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          ...cardShell,
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.5) 0%, rgba(99,102,241,0.38) 45%, rgba(139,92,246,0.35) 100%)",
          boxShadow:
            "0 6px 28px rgba(99, 102, 241, 0.28), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -24,
            right: -24,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 14,
          }}
        >
          <span style={{ color: "rgba(241,245,249,0.92)", fontSize: 13, fontWeight: 600 }}>
            近 24 小时事件
          </span>
          <span style={{ color: "#e0e7ff" }}>
            <IconEye />
          </span>
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            textShadow: "0 0 48px rgba(165, 180, 252, 0.55)",
          }}
        >
          {last24h}
        </div>
      </div>
      <div
        style={{
          ...cardShell,
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.45) 0%, rgba(139,92,246,0.42) 50%, rgba(168,85,247,0.38) 100%)",
          border: "1px solid rgba(196, 181, 253, 0.22)",
          boxShadow:
            "0 6px 28px rgba(139, 92, 246, 0.26), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: -20,
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 14,
          }}
        >
          <span style={{ color: "rgba(241,245,249,0.92)", fontSize: 13, fontWeight: 600 }}>
            近 7 天事件
          </span>
          <span style={{ color: "#ede9fe" }}>
            <IconActivity />
          </span>
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#faf5ff",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            textShadow: "0 0 48px rgba(192, 132, 252, 0.45)",
          }}
        >
          {last7d}
        </div>
      </div>
    </div>
  );
}

function AdminPathBars({ rows }: { rows: [string, number][] }) {
  const maxN = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div style={{ padding: "6px 0 4px" }}>
      {rows.map(([path, n]) => {
        const pct = Math.round((n / maxN) * 100);
        return (
          <div key={path} style={{ marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    marginBottom: 8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={path}
                >
                  {path}
                </div>
                <div className="admin-dash-path-bar-track">
                  <div className="admin-dash-path-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div
                style={{
                  fontFamily: ADMIN_MONO,
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  minWidth: 48,
                  textAlign: "right",
                }}
              >
                {n}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<
    "notes" | "podcast" | "report" | "wmp" | "stats" | "visitors"
  >("notes");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [podTitle, setPodTitle] = useState("");
  const [podDesc, setPodDesc] = useState("");
  const [podDate, setPodDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [podFile, setPodFile] = useState<File | null>(null);

  const [reportTitle, setReportTitle] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportFile, setReportFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [statsPayload, setStatsPayload] = useState<AdminAnalyticsJson | null>(null);
  const [statsGeoMap, setStatsGeoMap] = useState<Record<string, string>>({});

  type VisitorLogRow = {
    id: number;
    page: string;
    ip: string | null;
    country: string | null;
    city: string | null;
    user_agent: string | null;
    referer: string | null;
    visited_at: string;
  };
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorsErr, setVisitorsErr] = useState<string | null>(null);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLogRow[]>([]);

  const [wmpScrapeLoading, setWmpScrapeLoading] = useState(false);
  const [wmpScrapeMsg, setWmpScrapeMsg] = useState<string | null>(null);

  type VisitorGeoCell =
    | { status: "loading" }
    | { status: "done"; location: string; orgNote: string };
  const visitorGeoCacheRef = useRef<Record<string, VisitorGeoCell>>({});
  /** 仅用于在 ref 更新后触发重绘（切换 Tab 回来时沿用缓存，不重复请求） */
  const [visitorGeoTick, setVisitorGeoTick] = useState(0);

  function getVisitorGeoCell(ip: string | null): VisitorGeoCell {
    if (!ip?.trim()) return { status: "done", location: "—", orgNote: "—" };
    return visitorGeoCacheRef.current[ip] ?? { status: "loading" };
  }

  async function loadVisitors() {
    setVisitorsLoading(true);
    setVisitorsErr(null);
    try {
      // 密码可能含中文：勿放请求头（Fetch 要求 ByteString）；用 query + encodeURIComponent
      const res = await fetch(
        `/api/admin/visitors?pwd=${encodeURIComponent(pwd)}`
      );
      const j = (await res.json()) as { error?: string; logs?: VisitorLogRow[] };
      if (!res.ok) {
        setVisitorsErr(j.error || "加载失败");
        setVisitorLogs([]);
        return;
      }
      if (j.error && (!j.logs || j.logs.length === 0)) {
        setVisitorsErr(j.error);
        setVisitorLogs([]);
        return;
      }
      setVisitorLogs(j.logs ?? []);
    } catch {
      setVisitorsErr("网络错误");
      setVisitorLogs([]);
    } finally {
      setVisitorsLoading(false);
    }
  }

  async function runWmpScrape() {
    setWmpScrapeLoading(true);
    setWmpScrapeMsg(null);
    try {
      const res = await fetch("/api/admin/scrape-wmp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pwd }),
      });
      const j = (await res.json()) as {
        success?: boolean;
        message?: string;
        written?: number;
        scraped?: number;
        skipped?: boolean;
      };
      const detail =
        typeof j.written === "number" && typeof j.scraped === "number"
          ? `（写入 ${j.written} 条 / 抓取 ${j.scraped} 条${j.skipped ? " · 已跳过" : ""}）`
          : "";
      if (!res.ok || j.success === false) {
        setWmpScrapeMsg(`❌ ${j.message || "抓取失败"}${detail}`);
        return;
      }
      setWmpScrapeMsg(`✅ ${j.message || "完成"}${detail}`);
    } catch {
      setWmpScrapeMsg("❌ 网络错误");
    } finally {
      setWmpScrapeLoading(false);
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsErr(null);
    try {
      const res = await fetch(
        `/api/admin/analytics?pwd=${encodeURIComponent(pwd)}`
      );
      const j = (await res.json()) as AdminAnalyticsJson;
      if (!res.ok) {
        setStatsErr(j.error || "加载失败");
        setStatsPayload(null);
        return;
      }
      setStatsPayload(j);
    } catch {
      setStatsErr("网络错误");
      setStatsPayload(null);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    if (authed && tab === "stats") void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在进入统计页时拉取；密码以当前 pwd 为准
  }, [authed, tab, pwd]);

  useEffect(() => {
    if (!authed || tab !== "stats") return;
    const ips = Array.from(
      new Set(
        (statsPayload?.recent || [])
          .map((r) => r.ip?.trim())
          .filter((x): x is string => Boolean(x))
          .filter((ip) => !isPrivateOrLocalIp(ip))
      )
    ).filter((ip) => !statsGeoMap[ip]);

    if (ips.length === 0) return;

    let cancelled = false;

    const run = async () => {
      try {
        const pairs = await Promise.all(
          ips.map(async (ip) => {
            const res = await fetch(`/api/geoip?ip=${encodeURIComponent(ip)}`, {
              cache: "no-store",
            });
            if (!res.ok) return [ip, ip] as const;
            const j = (await res.json()) as {
              city: string | null;
              country: string | null;
              region: string | null;
            };

            const country = (j.country || "").trim();
            const isChina = country.toUpperCase() === "CN" || country === "中国";

            let label = ip;
            if (isChina) {
              label = (j.city || j.region || "中国") ?? "中国";
            } else {
              const city = (j.city || "").trim();
              if (city && country) label = `${city}, ${country}`;
              else if (country) label = country;
            }
            return [ip, label] as const;
          })
        );

        if (cancelled) return;
        setStatsGeoMap((prev) => {
          const next = { ...prev };
          for (const [ip, label] of pairs) next[ip] = label;
          return next;
        });
      } catch {
        // ignore
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authed, tab, statsPayload, statsGeoMap]);

  useEffect(() => {
    if (authed && tab === "visitors") void loadVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab, pwd]);

  useEffect(() => {
    if (!authed || tab !== "visitors") return;

    const ips = Array.from(
      new Set(
        visitorLogs
          .map((r) => r.ip?.trim())
          .filter((x): x is string => Boolean(x))
      )
    );

    let cancelled = false;

    const run = async () => {
      for (const ip of ips) {
        if (cancelled) break;
        const cache = visitorGeoCacheRef.current;
        if (cache[ip]?.status === "done") continue;

        if (isPrivateOrLocalIp(ip)) {
          cache[ip] = {
            status: "done",
            location: "🏠 内网/本地",
            orgNote: "—",
          };
          setVisitorGeoTick((t) => t + 1);
          continue;
        }

        cache[ip] = { status: "loading" };
        setVisitorGeoTick((t) => t + 1);

        try {
          const res = await fetch(
            `/api/admin/ip-geo?pwd=${encodeURIComponent(pwd)}&ip=${encodeURIComponent(ip)}`
          );
          const j = (await res.json()) as IpApiFields & { error?: string };

          if (cancelled) break;

          if (!res.ok || j.error) {
            cache[ip] = {
              status: "done",
              location: "—",
              orgNote: typeof j.error === "string" ? j.error : "查询失败",
            };
          } else {
            cache[ip] = {
              status: "done",
              location: formatLocationLine(j),
              orgNote: formatOrgNote(j.org),
            };
          }
        } catch {
          if (!cancelled) {
            cache[ip] = {
              status: "done",
              location: "—",
              orgNote: "网络错误",
            };
          }
        }

        setVisitorGeoTick((t) => t + 1);
        await new Promise((r) => setTimeout(r, 50));
      }
    };

    void run();
    return () => {
      cancelled = true;
      const cache = visitorGeoCacheRef.current;
      for (const k of Object.keys(cache)) {
        if (cache[k]?.status === "loading") delete cache[k];
      }
      setVisitorGeoTick((t) => t + 1);
    };
  }, [authed, tab, visitorLogs, pwd]);

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0f1e",
      color: "#e2e8f0",
      padding: "40px 24px",
    },
    card: {
      background: "#0d1b2e",
      border: "1px solid #1e3a5f",
      borderRadius: "12px",
      padding: "24px",
      maxWidth: "600px",
      margin: "0 auto",
    },
    input: {
      width: "100%",
      background: "#0f2744",
      color: "#e2e8f0",
      border: "1px solid #1e3a5f",
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "14px",
      marginBottom: "12px",
      boxSizing: "border-box" as const,
      fontFamily: "inherit",
    },
    btn: {
      background: "#0f2744",
      color: "#60a5fa",
      border: "1px solid #3b82f6",
      borderRadius: "8px",
      padding: "10px 20px",
      fontSize: "14px",
      cursor: "pointer",
      width: "100%",
      fontFamily: "inherit",
    },
    tab: (active: boolean) =>
      ({
        background: active ? "#1e3a5f" : "transparent",
        color: active ? "#60a5fa" : "#64748b",
        border: "1px solid #1e3a5f",
        borderRadius: "8px",
        padding: "8px 16px",
        cursor: "pointer",
        marginRight: "8px",
        fontSize: "13px",
        fontFamily: "inherit",
      }) as React.CSSProperties,
  };

  async function uploadFile(file: File, bucket: string): Promise<string> {
    const supabase = getBrowserSupabase();
    if (!supabase) throw new Error("Supabase 未配置");
    const fileName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function publishNote() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMsg("请先配置 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    if (!noteTitle || !noteContent) {
      setMsg("请填写标题和内容");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("market_notes").insert({
      title: noteTitle,
      content: noteContent,
      date: noteDate,
    });
    setLoading(false);
    if (error) setMsg("发布失败: " + error.message);
    else {
      setMsg("✅ 发布成功");
      setNoteTitle("");
      setNoteContent("");
    }
  }

  async function publishPodcast() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMsg("请先配置 Supabase 环境变量");
      return;
    }
    if (!podTitle || !podFile) {
      setMsg("请填写标题并上传音频");
      return;
    }
    setLoading(true);
    try {
      const audioUrl = await uploadFile(podFile, "podcasts");
      const { error } = await supabase.from("podcasts").insert({
        title: podTitle,
        description: podDesc || null,
        date: podDate,
        audio_url: audioUrl,
      });
      if (error) throw error;
      setMsg("✅ 播客上传成功");
      setPodTitle("");
      setPodDesc("");
      setPodFile(null);
    } catch (e: unknown) {
      setMsg("失败: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function publishReport() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMsg("请先配置 Supabase 环境变量");
      return;
    }
    if (!reportTitle || !reportFile) {
      setMsg("请填写标题并上传 PDF");
      return;
    }
    setLoading(true);
    try {
      const fileUrl = await uploadFile(reportFile, "reports");
      const { error } = await supabase.from("daily_reports").insert({
        title: reportTitle,
        date: reportDate,
        file_url: fileUrl,
      });
      if (error) throw error;
      setMsg("✅ 报告上传成功");
      setReportTitle("");
      setReportFile(null);
    } catch (e: unknown) {
      setMsg("失败: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  if (!isBrowserSupabaseConfigured()) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h2 style={{ color: "#e2e8f0", marginBottom: "16px" }}>⚙️ 管理员后台</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
            请在 <code style={{ color: "#60a5fa" }}>.env.local</code> 中配置{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> 与{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>（与现有 Supabase 项目一致即可，通常与
            服务端 <code>SUPABASE_URL</code> / anon key 相同），重新 build 后使用。
          </p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h2 style={{ color: "#e2e8f0", marginBottom: "24px" }}>🔐 管理员登录</h2>
          <input
            type="password"
            placeholder="输入管理员密码"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            style={s.input}
          />
          <button
            type="button"
            style={s.btn}
            onClick={() => {
              if (pwd === ADMIN_PASSWORD) {
                setAuthed(true);
                setMsg("");
              } else setMsg("密码错误");
            }}
          >
            登录
          </button>
          {msg && (
            <p style={{ color: "#ef4444", marginTop: "12px", fontSize: 14 }}>{msg}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...s.page,
        background:
          tab === "stats" || tab === "visitors" ? "#0a0e1a" : s.page.background,
      }}
    >
      <div
        style={{
          maxWidth: tab === "stats" || tab === "visitors" ? "980px" : "600px",
          margin: "0 auto",
        }}
      >
        <h2 style={{ color: "#e2e8f0", marginBottom: "24px" }}>⚙️ 管理员后台</h2>
        <div style={{ marginBottom: "24px", flexWrap: "wrap", display: "flex", gap: 8 }}>
          {(["notes", "podcast", "report", "wmp", "stats", "visitors"] as const).map(
            (t) => (
            <button
              key={t}
              type="button"
              style={s.tab(tab === t)}
              onClick={() => {
                setTab(t);
                setMsg("");
              }}
            >
              {t === "notes"
                ? "📝 市场笔记"
                : t === "podcast"
                  ? "🎙️ 播客"
                  : t === "report"
                    ? "📄 每日报告"
                    : t === "wmp"
                      ? "🏦 WMP 净值"
                      : t === "stats"
                        ? "📊 阅读统计"
                        : "📋 访问记录"}
            </button>
          )
          )}
        </div>

        <div
          style={{
            ...s.card,
            maxWidth: tab === "stats" || tab === "visitors" ? "980px" : "600px",
            ...(tab === "stats" || tab === "visitors"
              ? {
                  background: "rgba(13, 27, 46, 0.72)",
                  border: "1px solid rgba(59, 130, 246, 0.12)",
                  boxShadow:
                    "0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
                }
              : {}),
          }}
        >
          {tab === "stats" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
                  阅读统计
                </h3>
                <button
                  type="button"
                  style={{ ...s.btn, width: "auto", padding: "8px 16px" }}
                  onClick={() => void loadStats()}
                  disabled={statsLoading}
                >
                  {statsLoading ? "刷新中…" : "刷新"}
                </button>
              </div>
              <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                记录前台页面浏览（含路径）、用户 IP（经 CDN 时为 X-Forwarded-For）、以及笔记曝光 / PDF 点击 / 播客播放。需在 Supabase 执行{" "}
                <code style={{ color: "#60a5fa" }}>supabase_analytics.sql</code>，并在服务端配置{" "}
                <code style={{ color: "#60a5fa" }}>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                后此处才可读库；未配置时事件仍会尝试写入（需{" "}
                <code style={{ color: "#60a5fa" }}>SUPABASE_URL</code> /{" "}
                <code style={{ color: "#60a5fa" }}>SUPABASE_KEY</code>）。
              </p>
              {statsErr && (
                <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{statsErr}</p>
              )}
              {statsPayload?.error && (
                <p
                  style={{
                    color: "#fbbf24",
                    fontSize: 14,
                    marginBottom: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {statsPayload.error}
                </p>
              )}
              {statsPayload?.summary && (
                <>
                  <AdminStatHeroCards
                    last24h={statsPayload.summary.last24h}
                    last7d={statsPayload.summary.last7d}
                  />
                  {(statsPayload.summary.byPath.length > 0 ||
                    statsPayload.summary.contentReads.length > 0) && (
                    <div className="admin-dash-divider" />
                  )}
                  {statsPayload.summary.byPath.length > 0 && (
                    <div
                      style={{
                        marginBottom: 24,
                        borderRadius: 14,
                        border: "1px solid rgba(30,58,95,0.55)",
                        padding: "20px 22px",
                        background: "rgba(13,27,46,0.45)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      <h4 className="admin-dash-section-title">近 7 天 · 路径分布</h4>
                      <AdminPathBars rows={statsPayload.summary.byPath} />
                    </div>
                  )}
                  {statsPayload.summary.byPath.length > 0 &&
                    statsPayload.summary.contentReads.length > 0 && (
                      <div className="admin-dash-divider" />
                    )}
                  {statsPayload.summary.contentReads.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h4 className="admin-dash-section-title">
                        近 7 天 · 内容阅读（类型:id）
                      </h4>
                      <div className="admin-dash-table-wrap" style={{ maxHeight: 320 }}>
                        <table className="admin-dash-table">
                          <thead>
                            <tr>
                              <th>内容</th>
                              <th style={{ width: 88 }}>次数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsPayload.summary.contentReads.map(([key, n]) => (
                              <tr key={key}>
                                <td>{key}</td>
                                <td
                                  className="admin-dash-mono"
                                  style={{ fontWeight: 600, color: "#94a3b8" }}
                                >
                                  {n}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              {statsPayload?.summary && statsPayload.recent.length > 0 && (
                <div className="admin-dash-divider" />
              )}
              {statsPayload && statsPayload.recent.length > 0 && (
                <div>
                  <h4 className="admin-dash-section-title">最近事件（最多 200 条）</h4>
                  <div className="admin-dash-table-wrap" style={{ maxHeight: 440 }}>
                    <table className="admin-dash-table" style={{ minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th>时间</th>
                          <th>地区</th>
                          <th>类型</th>
                          <th>路径</th>
                          <th>内容</th>
                          <th>UA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsPayload.recent.map((r) => {
                          const b = statsEventBadge(r.event_type, r.content_type);
                          return (
                            <tr key={r.id}>
                              <td
                                className="admin-dash-mono"
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {formatBeijingTime(r.created_at)}
                              </td>
                              <td className="admin-dash-mono">
                                {r.ip
                                  ? statsGeoMap[r.ip.trim()] || r.ip
                                  : "—"}
                              </td>
                              <td>
                                <span
                                  className="admin-dash-badge"
                                  style={{
                                    background: b.bg,
                                    color: b.color,
                                    border: b.border,
                                  }}
                                >
                                  {b.label}
                                </span>
                              </td>
                              <td>{r.page_path}</td>
                              <td>
                                {r.content_type
                                  ? `${r.content_type}${r.content_id != null ? ` #${r.content_id}` : ""}`
                                  : "—"}
                              </td>
                              <td
                                className="admin-dash-mono"
                                style={{ maxWidth: 200 }}
                                title={r.user_agent || undefined}
                              >
                                {(r.user_agent || "—").slice(0, 80)}
                                {(r.user_agent?.length || 0) > 80 ? "…" : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {!statsLoading && statsPayload && statsPayload.recent.length === 0 && !statsPayload.error && (
                <p style={{ color: "#64748b", fontSize: 14 }}>暂无事件数据。</p>
              )}
            </>
          )}

          {tab === "visitors" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>
                  访问记录
                </h3>
                <button
                  type="button"
                  style={{ ...s.btn, width: "auto", padding: "8px 16px" }}
                  onClick={() => void loadVisitors()}
                  disabled={visitorsLoading}
                >
                  {visitorsLoading ? "刷新中…" : "刷新"}
                </button>
              </div>
              <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                数据来自 <code style={{ color: "#60a5fa" }}>visitor_logs</code>，由{" "}
                <code style={{ color: "#60a5fa" }}>/api/track</code> 写入（服务端{" "}
                <code style={{ color: "#60a5fa" }}>SUPABASE_SERVICE_ROLE_KEY</code>）。请在
                Supabase 执行 <code style={{ color: "#60a5fa" }}>supabase_visitor_logs.sql</code>
                ；自建服务器在 <code style={{ color: "#60a5fa" }}>.env.local</code> 配置密钥后{" "}
                <code>npm run build && npm start</code> 或 PM2 重启。
              </p>
              {visitorsErr && (
                <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{visitorsErr}</p>
              )}
              {visitorLogs.length > 0 && (
                <>
                  <h4 className="admin-dash-section-title">最近访问</h4>
                  <div className="admin-dash-table-wrap" style={{ maxHeight: 480 }}>
                    <table className="admin-dash-table" style={{ minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th>时间</th>
                          <th>设备</th>
                          <th>页面</th>
                          <th>归属地</th>
                          <th>运营商/备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visitorLogs.map((row) => {
                          void visitorGeoTick;
                          const geo = getVisitorGeoCell(row.ip);
                          return (
                            <tr key={row.id}>
                              <td
                                className="admin-dash-mono"
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {formatBeijingTime(row.visited_at)}
                              </td>
                              <td style={{ maxWidth: 200 }} title={row.user_agent || undefined}>
                                {formatDeviceCell(row.user_agent)}
                              </td>
                              <td>{row.page}</td>
                              <td style={{ minWidth: 140 }}>
                                {geo.status === "loading" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0,
                                      color: "#64748b",
                                      fontSize: 12,
                                    }}
                                  >
                                    <span className="admin-geo-spinner" aria-hidden />
                                    <span>解析中…</span>
                                  </div>
                                ) : (
                                  <>
                                    <div>{geo.location}</div>
                                    {row.ip ? (
                                      <small
                                        className="admin-dash-mono"
                                        style={{
                                          display: "block",
                                          opacity: 0.4,
                                          marginTop: 4,
                                          fontSize: 11,
                                        }}
                                      >
                                        {row.ip}
                                      </small>
                                    ) : null}
                                  </>
                                )}
                              </td>
                              <td style={{ maxWidth: 280 }}>
                                {geo.status === "done" ? (
                                  <>
                                    <div>{geo.orgNote}</div>
                                    {row.referer ? (
                                      <small
                                        style={{
                                          display: "block",
                                          opacity: 0.55,
                                          marginTop: 4,
                                          fontSize: 11,
                                          wordBreak: "break-all",
                                        }}
                                        title={row.referer}
                                      >
                                        {row.referer.length > 72
                                          ? `${row.referer.slice(0, 72)}…`
                                          : row.referer}
                                      </small>
                                    ) : null}
                                  </>
                                ) : (
                                  <span style={{ color: "#64748b", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!visitorsLoading && visitorLogs.length === 0 && !visitorsErr && (
                <p style={{ color: "#64748b", fontSize: 14 }}>暂无访问记录。</p>
              )}
            </>
          )}

          {tab === "notes" && (
            <>
              <h3 style={{ marginBottom: "16px" }}>发布市场笔记</h3>
              <input
                placeholder="标题"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                style={s.input}
              />
              <input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                style={s.input}
              />
              <textarea
                placeholder="内容（支持 Markdown）"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                style={{ ...s.input, height: "200px", resize: "vertical" }}
              />
              <button
                type="button"
                style={s.btn}
                onClick={publishNote}
                disabled={loading}
              >
                {loading ? "发布中..." : "发布笔记"}
              </button>
            </>
          )}

          {tab === "podcast" && (
            <>
              <h3 style={{ marginBottom: "16px" }}>上传播客</h3>
              <input
                placeholder="播客标题"
                value={podTitle}
                onChange={(e) => setPodTitle(e.target.value)}
                style={s.input}
              />
              <input
                type="date"
                value={podDate}
                onChange={(e) => setPodDate(e.target.value)}
                style={s.input}
              />
              <textarea
                placeholder="简介"
                value={podDesc}
                onChange={(e) => setPodDesc(e.target.value)}
                style={{ ...s.input, height: "100px", resize: "vertical" }}
              />
              <input
                type="file"
                accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
                onChange={(e) => setPodFile(e.target.files?.[0] ?? null)}
                style={s.input}
              />
              <button
                type="button"
                style={s.btn}
                onClick={publishPodcast}
                disabled={loading}
              >
                {loading ? "上传中..." : "上传播客"}
              </button>
            </>
          )}

          {tab === "wmp" && (
            <>
              <h3 style={{ marginBottom: "12px" }}>WMP 净值抓取</h3>
              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                在服务器上执行{" "}
                <code style={{ color: "#60a5fa" }}>wmp_scraper</code> 逻辑，结果追加到仓库根目录{" "}
                <code style={{ color: "#60a5fa" }}>data/wmp_history.csv</code>
                。若 CSV 已含<strong>当日（上海）</strong>任意一行，则跳过（幂等）。生产建议用 crontab 每日运行，见{" "}
                <code style={{ color: "#60a5fa" }}>scripts/crontab-wmp.example.txt</code>。
              </p>
              <button
                type="button"
                style={s.btn}
                onClick={() => void runWmpScrape()}
                disabled={wmpScrapeLoading}
              >
                {wmpScrapeLoading ? "抓取中…" : "🔄 立即抓取 WMP 净值"}
              </button>
              {wmpScrapeMsg && (
                <p
                  style={{
                    marginTop: 16,
                    color: wmpScrapeMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {wmpScrapeMsg}
                </p>
              )}
            </>
          )}

          {tab === "report" && (
            <>
              <h3 style={{ marginBottom: "16px" }}>上传每日报告</h3>
              <input
                placeholder="报告标题"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                style={s.input}
              />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                style={s.input}
              />
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                style={s.input}
              />
              <button
                type="button"
                style={s.btn}
                onClick={publishReport}
                disabled={loading}
              >
                {loading ? "上传中..." : "上传报告"}
              </button>
            </>
          )}

          {msg && tab !== "wmp" && (
            <p
              style={{
                marginTop: "16px",
                color: msg.includes("✅") ? "#22c55e" : "#ef4444",
                fontSize: 14,
              }}
            >
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
