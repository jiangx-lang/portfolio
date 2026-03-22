"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

const btn: CSSProperties = {
  display: "inline-block",
  padding: "10px 28px",
  background: "#0f2744",
  color: "#60a5fa",
  border: "1px solid #3b82f6",
  borderRadius: "8px",
  fontSize: "14px",
  textDecoration: "none",
  textAlign: "center" as const,
};

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
          maxWidth: "360px",
          lineHeight: 1.5,
        }}
      >
        市场笔记、每日报告与播客已在本站提供，与 Model Portfolio 共用同一套入口。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <Link href="/notes" style={btn}>
          进入市场资讯与报告 →
        </Link>
        <Link href="/podcast" style={btn}>
          进入播客 →
        </Link>
      </div>
    </div>
  );
}
