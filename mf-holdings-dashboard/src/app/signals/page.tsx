"use client";

import { useEffect } from "react";

// 用环境变量区分本地和线上
const STREAMLIT_URL = process.env.NEXT_PUBLIC_STREAMLIT_URL ?? "http://127.0.0.1:8501";

export default function MarketPage() {
  useEffect(() => {
    // 自动打开 Streamlit（新标签页），同时保留页面内手动入口
    window.open(STREAMLIT_URL, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "16px",
        background: "rgb(9, 18, 39)",
        padding: "24px",
      }}
    >
      <p style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", maxWidth: 520 }}>
        市场笔记与播客内容由锦城系统提供
      </p>

      <a
        href={STREAMLIT_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "10px 24px",
          background: "#1e3a5f",
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
