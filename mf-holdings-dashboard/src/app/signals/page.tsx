"use client";

/** 锦城 Streamlit；生产环境在 .env.local 设置 NEXT_PUBLIC_STREAMLIT_URL */
const STREAMLIT_URL =
  process.env.NEXT_PUBLIC_STREAMLIT_URL ?? "https://atlasallocations.com";

export default function SignalsPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "20px",
        background: "rgb(9, 18, 39)",
        padding: "24px",
      }}
    >
      <div style={{ color: "#60a5fa", fontSize: "32px" }} aria-hidden>
        📊
      </div>
      <h2 style={{ color: "#e2e8f0", fontSize: "20px", fontWeight: 500 }}>市场资讯</h2>
      <p
        style={{
          color: "#64748b",
          fontSize: "13px",
          textAlign: "center",
          maxWidth: "320px",
          lineHeight: 1.5,
        }}
      >
        市场笔记、播客与每日报告由锦城系统提供
      </p>
      <a
        href={STREAMLIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "10px 28px",
          background: "#0f2744",
          color: "#60a5fa",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          fontSize: "14px",
          textDecoration: "none",
        }}
      >
        进入锦城系统 →
      </a>
    </div>
  );
}
