"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function RiskPage() {
  const [content, setContent] = useState("");
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/risk-report")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content || d.error || "");
        setUpdated(d.updated || "");
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        color: "#e2e8f0",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <a
          href="/"
          style={{
            color: "#64748b",
            fontSize: "13px",
            textDecoration: "none",
          }}
        >
          ← 返回首页
        </a>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "16px 0 32px",
          }}
        >
          <h1 style={{ color: "#e2e8f0", margin: 0 }}>🚨 宏观风险监控</h1>
          {updated && (
            <span style={{ color: "#64748b", fontSize: "12px" }}>
              更新：{new Date(updated).toLocaleString("zh-CN")}
            </span>
          )}
        </div>
        {loading && <p style={{ color: "#64748b" }}>加载中...</p>}
        <div
          style={{
            background: "#0d1b2e",
            border: "1px solid #1e3a5f",
            borderRadius: "12px",
            padding: "32px",
            lineHeight: "1.8",
            fontSize: "14px",
          }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
