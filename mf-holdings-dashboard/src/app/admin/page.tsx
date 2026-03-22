"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";

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

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<
    "notes" | "podcast" | "report" | "stats" | "visitors"
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
    if (authed && tab === "visitors") void loadVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab, pwd]);

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

  const tableHead = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "1px solid #1e3a5f",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
  };
  const tableCell = {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(30,58,95,0.5)",
    fontSize: 13,
    color: "#cbd5e1",
    verticalAlign: "top" as const,
    wordBreak: "break-all" as const,
  };

  return (
    <div style={s.page}>
      <div
        style={{
          maxWidth: tab === "stats" || tab === "visitors" ? "980px" : "600px",
          margin: "0 auto",
        }}
      >
        <h2 style={{ color: "#e2e8f0", marginBottom: "24px" }}>⚙️ 管理员后台</h2>
        <div style={{ marginBottom: "24px", flexWrap: "wrap", display: "flex", gap: 8 }}>
          {(["notes", "podcast", "report", "stats", "visitors"] as const).map((t) => (
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
                    : t === "stats"
                      ? "📊 阅读统计"
                      : "📋 访问记录"}
            </button>
          ))}
        </div>

        <div
          style={{
            ...s.card,
            maxWidth: tab === "stats" || tab === "visitors" ? "980px" : "600px",
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
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: 0 }}>访问与阅读统计</h3>
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ background: "#0f2744", borderRadius: 8, padding: 12 }}>
                    <div style={{ color: "#64748b", fontSize: 12 }}>近 24 小时事件</div>
                    <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
                      {statsPayload.summary.last24h}
                    </div>
                  </div>
                  <div style={{ background: "#0f2744", borderRadius: 8, padding: 12 }}>
                    <div style={{ color: "#64748b", fontSize: 12 }}>近 7 天事件</div>
                    <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
                      {statsPayload.summary.last7d}
                    </div>
                  </div>
                </div>
              )}
              {statsPayload?.summary && statsPayload.summary.byPath.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
                    近 7 天 · 按路径（含 page + content）
                  </h4>
                  <div style={{ overflowX: "auto", border: "1px solid #1e3a5f", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={tableHead}>路径</th>
                          <th style={{ ...tableHead, width: 90 }}>次数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsPayload.summary.byPath.map(([path, n]) => (
                          <tr key={path}>
                            <td style={tableCell}>{path}</td>
                            <td style={tableCell}>{n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {statsPayload?.summary && statsPayload.summary.contentReads.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
                    近 7 天 · 内容阅读（类型:id）
                  </h4>
                  <div style={{ overflowX: "auto", border: "1px solid #1e3a5f", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={tableHead}>内容</th>
                          <th style={{ ...tableHead, width: 90 }}>次数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsPayload.summary.contentReads.map(([key, n]) => (
                          <tr key={key}>
                            <td style={tableCell}>{key}</td>
                            <td style={tableCell}>{n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {statsPayload && statsPayload.recent.length > 0 && (
                <div>
                  <h4 style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
                    最近记录（最多 200 条）
                  </h4>
                  <div
                    style={{
                      overflowX: "auto",
                      maxHeight: 420,
                      overflowY: "auto",
                      border: "1px solid #1e3a5f",
                      borderRadius: 8,
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                      <thead style={{ position: "sticky", top: 0, background: "#0d1b2e" }}>
                        <tr>
                          <th style={tableHead}>时间 (UTC)</th>
                          <th style={tableHead}>IP</th>
                          <th style={tableHead}>类型</th>
                          <th style={tableHead}>路径</th>
                          <th style={tableHead}>内容</th>
                          <th style={tableHead}>UA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsPayload.recent.map((r) => (
                          <tr key={r.id}>
                            <td style={{ ...tableCell, whiteSpace: "nowrap" }}>
                              {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}
                            </td>
                            <td style={tableCell}>{r.ip || "—"}</td>
                            <td style={tableCell}>{r.event_type}</td>
                            <td style={tableCell}>{r.page_path}</td>
                            <td style={tableCell}>
                              {r.content_type
                                ? `${r.content_type}${r.content_id != null ? ` #${r.content_id}` : ""}`
                                : "—"}
                            </td>
                            <td style={{ ...tableCell, maxWidth: 220 }} title={r.user_agent || ""}>
                              {(r.user_agent || "—").slice(0, 80)}
                              {(r.user_agent?.length || 0) > 80 ? "…" : ""}
                            </td>
                          </tr>
                        ))}
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
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: 0 }}>页面访问记录</h3>
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
                <div
                  style={{
                    overflowX: "auto",
                    maxHeight: 480,
                    overflowY: "auto",
                    border: "1px solid #1e3a5f",
                    borderRadius: 8,
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                    <thead style={{ position: "sticky", top: 0, background: "#0d1b2e" }}>
                      <tr>
                        <th style={tableHead}>时间</th>
                        <th style={tableHead}>页面</th>
                        <th style={tableHead}>IP</th>
                        <th style={tableHead}>UA（前 50 字）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorLogs.map((row) => (
                        <tr key={row.id}>
                          <td style={{ ...tableCell, whiteSpace: "nowrap" }}>
                            {new Date(row.visited_at).toISOString().replace("T", " ").slice(0, 19)}
                          </td>
                          <td style={tableCell}>{row.page}</td>
                          <td style={tableCell}>{row.ip || "—"}</td>
                          <td style={tableCell} title={row.user_agent || ""}>
                            {(row.user_agent || "—").slice(0, 50)}
                            {(row.user_agent?.length || 0) > 50 ? "…" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

          {msg && (
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
