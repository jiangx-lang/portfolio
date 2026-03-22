"use client";

export default function RiskPage() {
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
          FRED 数据 · 每日更新 · 仅供参考
        </span>
      </div>

      <iframe
        src="/api/risk-report-html"
        style={{
          flex: 1,
          width: "100%",
          height: "calc(100vh - 49px)",
          border: "none",
          background: "#0a0f1e",
        }}
        title="宏观风险监控报告"
      />
    </div>
  );
}
