"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Eye,
  FileText,
  Landmark,
  Lock,
  Podcast,
  RefreshCw,
  Shield,
} from "lucide-react";
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
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "cd123";

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

const ADMIN_INPUT_CLS =
  "mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30";

const ADMIN_TABS = [
  { key: "notes", label: "市场笔记", Icon: FileText },
  { key: "podcast", label: "播客", Icon: Podcast },
  { key: "report", label: "每日报告", Icon: BookOpen },
  { key: "wmp", label: "WMP 净值", Icon: Landmark },
  { key: "stats", label: "阅读统计", Icon: BarChart3 },
  { key: "visitors", label: "访问记录", Icon: Eye },
] as const;

function statsEventBadge(eventType: string, contentType: string | null) {
  if (eventType === "page") {
    return { label: "页面", cls: "badge-blue" };
  }
  if (contentType === "podcast") {
    return { label: "播放", cls: "badge-gold" };
  }
  return { label: "互动", cls: "badge-green" };
}

function AdminStatHeroCards({ last24h, last7d }: { last24h: number; last7d: number }) {
  return (
    <div className="mb-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      <div className="glass-card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-info/10 blur-2xl" />
        <div className="mb-4 flex items-start justify-between">
          <span className="text-[13px] font-semibold text-slate-300">近 24 小时事件</span>
          <Eye size={20} className="text-info" aria-hidden />
        </div>
        <div className="font-mono text-[42px] font-bold leading-none tracking-tight text-slate-50">
          {last24h}
        </div>
      </div>
      <div className="glass-card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl" />
        <div className="mb-4 flex items-start justify-between">
          <span className="text-[13px] font-semibold text-slate-300">近 7 天事件</span>
          <Activity size={20} className="text-gold" aria-hidden />
        </div>
        <div className="font-mono text-[42px] font-bold leading-none tracking-tight text-gold-light">
          {last7d}
        </div>
      </div>
    </div>
  );
}

function AdminPathBars({ rows }: { rows: [string, number][] }) {
  const maxN = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div className="py-1.5">
      {rows.map(([path, n]) => {
        const pct = Math.round((n / maxN) * 100);
        return (
          <div key={path} className="mb-4 last:mb-0">
            <div className="flex items-center gap-3.5">
              <div className="min-w-0 flex-1">
                <div
                  className="mb-2 truncate text-[13px] text-slate-300"
                  title={path}
                >
                  {path}
                </div>
                <div className="admin-dash-path-bar-track">
                  <div className="admin-dash-path-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="min-w-[48px] text-right font-mono text-[17px] font-bold text-slate-100">
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

  async function uploadFile(file: File, bucket: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        // 复用 admin 后台现有 pwd（服务端校验），避免把文件直接上传到 Supabase Storage
        Authorization: `Bearer ${pwd}`,
      },
      body: formData,
    });
    if (!res.ok) throw new Error("上传失败");
    const data = (await res.json()) as { url?: string };
    if (!data?.url) throw new Error("上传失败");
    return data.url;
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
      <div className="flex min-h-screen items-center justify-center bg-navy px-6 py-16 text-slate-200">
        <div className="glass-panel glow-border w-full max-w-lg rounded-2xl p-8">
          <span className="eyebrow">ATLAS ADMIN</span>
          <h2 className="mb-4 mt-2 flex items-center gap-2 font-display text-2xl font-bold">
            <Shield size={20} className="text-gold" aria-hidden />
            管理员后台
          </h2>
          <p className="text-sm leading-relaxed text-slate-400">
            请在 <code className="text-info">.env.local</code> 中配置{" "}
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
      <div className="flex min-h-screen items-center justify-center bg-navy px-6 py-16 text-slate-200">
        <div className="glass-panel glow-border animate-in w-full max-w-md rounded-2xl p-8">
          <span className="eyebrow">ATLAS ADMIN</span>
          <h2 className="mb-6 mt-2 flex items-center gap-2 font-display text-2xl font-bold">
            <Lock size={20} className="text-gold" aria-hidden />
            管理员登录
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pwd === ADMIN_PASSWORD) {
                setAuthed(true);
                setMsg("");
              } else setMsg("密码错误");
            }}
          >
            <input
              type="password"
              placeholder="输入管理员密码"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className={ADMIN_INPUT_CLS}
            />
            <button type="submit" className="btn-gold w-full">
              登录
            </button>
          </form>
          {msg && (
            <p className="mt-3 text-sm text-red-400">{msg}</p>
          )}
        </div>
      </div>
    );
  }

  const wideTab = tab === "stats" || tab === "visitors";

  return (
    <div className="min-h-screen bg-navy px-6 py-10 text-slate-200">
      <div className={`mx-auto ${wideTab ? "max-w-[980px]" : "max-w-[600px]"}`}>
        <header className="mb-6">
          <span className="eyebrow">ATLAS ADMIN</span>
          <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold">
            <Shield size={24} className="text-gold" aria-hidden />
            管理员后台
          </h2>
        </header>
        <div className="mb-6 flex flex-wrap gap-2">
          {ADMIN_TABS.map(({ key: t, label, Icon }) => (
            <button
              key={t}
              type="button"
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] font-medium transition-colors ${
                tab === t
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
              }`}
              onClick={() => {
                setTab(t);
                setMsg("");
              }}
            >
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="glass-panel animate-in rounded-2xl p-6">
          {tab === "stats" && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold text-slate-50">阅读统计</h3>
                <button
                  type="button"
                  className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void loadStats()}
                  disabled={statsLoading}
                >
                  <RefreshCw
                    size={14}
                    className={statsLoading ? "animate-spin" : undefined}
                    aria-hidden
                  />
                  {statsLoading ? "刷新中…" : "刷新"}
                </button>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                记录前台页面浏览（含路径）、用户 IP（经 CDN 时为 X-Forwarded-For）、以及笔记曝光 / PDF 点击 / 播客播放。需在 Supabase 执行{" "}
                <code className="text-info">supabase_analytics.sql</code>，并在服务端配置{" "}
                <code className="text-info">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                后此处才可读库；未配置时事件仍会尝试写入（需{" "}
                <code className="text-info">SUPABASE_URL</code> /{" "}
                <code className="text-info">SUPABASE_KEY</code>）。
              </p>
              {statsErr && (
                <p className="mb-3 text-sm text-red-400">{statsErr}</p>
              )}
              {statsPayload?.error && (
                <p className="mb-3 text-sm leading-relaxed text-amber-400">
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
                    <div className="glass-panel mb-6 px-[22px] py-5">
                      <h4 className="admin-dash-section-title">近 7 天 · 路径分布</h4>
                      <AdminPathBars rows={statsPayload.summary.byPath} />
                    </div>
                  )}
                  {statsPayload.summary.byPath.length > 0 &&
                    statsPayload.summary.contentReads.length > 0 && (
                      <div className="admin-dash-divider" />
                    )}
                  {statsPayload.summary.contentReads.length > 0 && (
                    <div className="mb-6">
                      <h4 className="admin-dash-section-title">
                        近 7 天 · 内容阅读（类型:id）
                      </h4>
                      <div className="admin-dash-table-wrap max-h-[320px]">
                        <table className="admin-dash-table">
                          <thead>
                            <tr>
                              <th>内容</th>
                              <th className="w-[88px]">次数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsPayload.summary.contentReads.map(([key, n]) => (
                              <tr key={key}>
                                <td>{key}</td>
                                <td className="admin-dash-mono font-semibold text-slate-400">
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
                  <div className="admin-dash-table-wrap max-h-[440px]">
                    <table className="admin-dash-table min-w-[720px]">
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
                              <td className="admin-dash-mono whitespace-nowrap">
                                {formatBeijingTime(r.created_at)}
                              </td>
                              <td className="admin-dash-mono">
                                {r.ip
                                  ? statsGeoMap[r.ip.trim()] || r.ip
                                  : "—"}
                              </td>
                              <td>
                                <span className={`admin-dash-badge ${b.cls}`}>
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
                                className="admin-dash-mono max-w-[200px]"
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
                <p className="text-sm text-slate-500">暂无事件数据。</p>
              )}
            </>
          )}

          {tab === "visitors" && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold text-slate-50">访问记录</h3>
                <button
                  type="button"
                  className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void loadVisitors()}
                  disabled={visitorsLoading}
                >
                  <RefreshCw
                    size={14}
                    className={visitorsLoading ? "animate-spin" : undefined}
                    aria-hidden
                  />
                  {visitorsLoading ? "刷新中…" : "刷新"}
                </button>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                数据来自 <code className="text-info">visitor_logs</code>，由{" "}
                <code className="text-info">/api/track</code> 写入（服务端{" "}
                <code className="text-info">SUPABASE_SERVICE_ROLE_KEY</code>）。请在
                Supabase 执行 <code className="text-info">supabase_visitor_logs.sql</code>
                ；自建服务器在 <code className="text-info">.env.local</code> 配置密钥后{" "}
                <code>npm run build && npm start</code> 或 PM2 重启。
              </p>
              {visitorsErr && (
                <p className="mb-3 text-sm text-red-400">{visitorsErr}</p>
              )}
              {visitorLogs.length > 0 && (
                <>
                  <h4 className="admin-dash-section-title">最近访问</h4>
                  <div className="admin-dash-table-wrap max-h-[480px]">
                    <table className="admin-dash-table min-w-[720px]">
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
                              <td className="admin-dash-mono whitespace-nowrap">
                                {formatBeijingTime(row.visited_at)}
                              </td>
                              <td className="max-w-[200px]" title={row.user_agent || undefined}>
                                {formatDeviceCell(row.user_agent)}
                              </td>
                              <td>{row.page}</td>
                              <td className="min-w-[140px]">
                                {geo.status === "loading" ? (
                                  <div className="flex items-center text-xs text-slate-500">
                                    <span className="admin-geo-spinner" aria-hidden />
                                    <span>解析中…</span>
                                  </div>
                                ) : (
                                  <>
                                    <div>{geo.location}</div>
                                    {row.ip ? (
                                      <small className="admin-dash-mono mt-1 block text-[11px] opacity-40">
                                        {row.ip}
                                      </small>
                                    ) : null}
                                  </>
                                )}
                              </td>
                              <td className="max-w-[280px]">
                                {geo.status === "done" ? (
                                  <>
                                    <div>{geo.orgNote}</div>
                                    {row.referer ? (
                                      <small
                                        className="mt-1 block break-all text-[11px] opacity-55"
                                        title={row.referer}
                                      >
                                        {row.referer.length > 72
                                          ? `${row.referer.slice(0, 72)}…`
                                          : row.referer}
                                      </small>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-500">—</span>
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
                <p className="text-sm text-slate-500">暂无访问记录。</p>
              )}
            </>
          )}

          {tab === "notes" && (
            <>
              <h3 className="mb-4 font-display text-lg font-bold">发布市场笔记</h3>
              <input
                placeholder="标题"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <textarea
                placeholder="内容（支持 Markdown）"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className={`${ADMIN_INPUT_CLS} h-[200px] resize-y`}
              />
              <button
                type="button"
                className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-60"
                onClick={publishNote}
                disabled={loading}
              >
                {loading ? "发布中..." : "发布笔记"}
              </button>
            </>
          )}

          {tab === "podcast" && (
            <>
              <h3 className="mb-4 font-display text-lg font-bold">上传播客</h3>
              <input
                placeholder="播客标题"
                value={podTitle}
                onChange={(e) => setPodTitle(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <input
                type="date"
                value={podDate}
                onChange={(e) => setPodDate(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <textarea
                placeholder="简介"
                value={podDesc}
                onChange={(e) => setPodDesc(e.target.value)}
                className={`${ADMIN_INPUT_CLS} h-[100px] resize-y`}
              />
              <input
                type="file"
                accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
                onChange={(e) => setPodFile(e.target.files?.[0] ?? null)}
                className={ADMIN_INPUT_CLS}
              />
              <button
                type="button"
                className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-60"
                onClick={publishPodcast}
                disabled={loading}
              >
                {loading ? "上传中..." : "上传播客"}
              </button>
            </>
          )}

          {tab === "wmp" && (
            <>
              <h3 className="mb-3 font-display text-lg font-bold">WMP 净值抓取</h3>
              <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
                在服务器上执行{" "}
                <code className="text-info">wmp_scraper</code> 逻辑，结果追加到仓库根目录{" "}
                <code className="text-info">data/wmp_history.csv</code>
                。若 CSV 已含<strong>当日（上海）</strong>任意一行，则跳过（幂等）。生产建议用 crontab 每日运行，见{" "}
                <code className="text-info">scripts/crontab-wmp.example.txt</code>。
              </p>
              <button
                type="button"
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void runWmpScrape()}
                disabled={wmpScrapeLoading}
              >
                <RefreshCw
                  size={14}
                  className={wmpScrapeLoading ? "animate-spin" : undefined}
                  aria-hidden
                />
                {wmpScrapeLoading ? "抓取中…" : "立即抓取 WMP 净值"}
              </button>
              {wmpScrapeMsg && (
                <p
                  className={`mt-4 text-sm leading-normal ${
                    wmpScrapeMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {wmpScrapeMsg}
                </p>
              )}
            </>
          )}

          {tab === "report" && (
            <>
              <h3 className="mb-4 font-display text-lg font-bold">上传每日报告</h3>
              <input
                placeholder="报告标题"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={ADMIN_INPUT_CLS}
              />
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                className={ADMIN_INPUT_CLS}
              />
              <button
                type="button"
                className="btn-gold w-full disabled:cursor-not-allowed disabled:opacity-60"
                onClick={publishReport}
                disabled={loading}
              >
                {loading ? "上传中..." : "上传报告"}
              </button>
            </>
          )}

          {msg && tab !== "wmp" && (
            <p
              className={`mt-4 text-sm ${
                msg.includes("✅") ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
