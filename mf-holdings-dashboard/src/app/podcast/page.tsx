"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase-browser";
import { trackAnalytics } from "@/lib/analytics-client";
import PasswordGate from "@/components/PasswordGate";

export type PodcastRow = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  audio_url: string | null;
  created_at?: string;
};

export default function PodcastPage() {
  return (
    <PasswordGate title="播客">
      <PodcastPageInner />
    </PasswordGate>
  );
}

function PodcastPageInner() {
  const [pods, setPods] = useState<PodcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
      marginBottom: "16px",
    },
  };

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/"
            style={{ color: "#60a5fa", fontSize: 13, textDecoration: "none" }}
          >
            ← 返回首页
          </Link>
        </div>
        <h1 style={{ color: "#e2e8f0", marginBottom: "8px" }}>🎙️ 播客</h1>
        <p style={{ color: "#64748b", marginBottom: "32px", fontSize: "13px" }}>
          音频市场解读
        </p>
        {loading && <p style={{ color: "#64748b" }}>加载中...</p>}
        {err && !loading && (
          <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p>
        )}
        {!loading && !err && pods.length === 0 && (
          <p style={{ color: "#64748b" }}>暂无播客</p>
        )}
        {pods.map((pod) => (
          <div key={pod.id} style={s.card}>
            <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "8px" }}>
              {pod.date}
            </div>
            <h3 style={{ color: "#e2e8f0", marginBottom: "8px" }}>{pod.title}</h3>
            {pod.description && (
              <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
                {pod.description}
              </p>
            )}
            {pod.audio_url && (
              <>
                <audio
                  controls
                  style={{ width: "100%", marginBottom: "12px" }}
                  onPlay={() =>
                    trackAnalytics({
                      event_type: "content",
                      page_path: "/podcast",
                      content_type: "podcast",
                      content_id: pod.id,
                    })
                  }
                >
                  <source src={pod.audio_url} />
                </audio>
                <a
                  href={pod.audio_url}
                  download
                  style={{ color: "#60a5fa", fontSize: "13px" }}
                >
                  ⬇️ 下载音频
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
