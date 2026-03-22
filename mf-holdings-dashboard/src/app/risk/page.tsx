"use client";

import { useState } from "react";

export default function RiskPage() {
  const [imgError, setImgError] = useState(false);
  const [cacheBust] = useState(() => Date.now());

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #1e3a5f",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
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
        <span style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 500 }}>
          🚨 宏观风险监控
        </span>
        <span
          style={{ color: "#64748b", fontSize: "12px", marginLeft: "auto" }}
        >
          FRED 长图 · 每日更新 · 仅供参考
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 12px 32px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {imgError ? (
          <p
            style={{
              color: "#94a3b8",
              textAlign: "center",
              padding: "48px 16px",
              fontSize: 14,
            }}
          >
            长图尚未生成或未同步到服务器（需{" "}
            <code style={{ color: "#cbd5e1" }}>crisis_report_long*</code>{" "}
            图片在云端输出目录）。请运行本地报告后执行{" "}
            <code style={{ color: "#cbd5e1" }}>sync_to_cloud.py</code>。
          </p>
        ) : (
          <img
            src={`/api/risk-report-long?v=${cacheBust}`}
            alt="宏观风险监控报告长图"
            onError={() => setImgError(true)}
            loading="eager"
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 1100,
              height: "auto",
              margin: "0 auto",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          />
        )}
      </div>
    </div>
  );
}
