"use client";

import { useState } from "react";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";

/** 仅前端门槛，会打进客户端包；生产请改服务端鉴权或服务_role API */
const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "atlas2024";

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"notes" | "podcast" | "report">("notes");

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
    <div style={s.page}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ color: "#e2e8f0", marginBottom: "24px" }}>⚙️ 管理员后台</h2>
        <div style={{ marginBottom: "24px" }}>
          {(["notes", "podcast", "report"] as const).map((t) => (
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
                  : "📄 每日报告"}
            </button>
          ))}
        </div>

        <div style={s.card}>
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
