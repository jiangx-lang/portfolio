"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** 与 Streamlit 内容区门禁一致；任一口令均可解锁本会话内全部受保护页面 */
const VALID_PASSWORDS = new Set(["fs123", "cd123"]);
const STORAGE_UNLOCKED = "atlas_gate_content_v1";

/** 全角/大小写/零宽字符等规范化后再比对，避免输入法导致 fs123、cd123 误判失败 */
function normalizeContentGatePassword(raw: string): string {
  let s = raw.trim().normalize("NFC");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xff01 && c <= 0xff5e) {
      out += String.fromCodePoint(c - 0xfee0);
    } else {
      out += ch;
    }
  }
  return out.toLowerCase();
}

type Props = {
  /** 锁屏页标题 */
  title: string;
  children: React.ReactNode;
};

export default function PasswordGate({ title, children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_UNLOCKED) === "1") setUnlocked(true);
    } catch {
      /* 隐私模式等 */
    }
  }, []);

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (VALID_PASSWORDS.has(normalizeContentGatePassword(input))) {
      try {
        sessionStorage.setItem(STORAGE_UNLOCKED, "1");
      } catch {
        /* ignore */
      }
      setWrong(false);
      setUnlocked(true);
    } else {
      setWrong(true);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 320,
    boxSizing: "border-box",
    background: "#0f2744",
    color: "#e2e8f0",
    border: "1px solid #1e3a5f",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 15,
    fontFamily: "inherit",
    marginBottom: 16,
  };

  const btnStyle: React.CSSProperties = {
    background: "#0f2744",
    color: "#60a5fa",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#0d1b2e",
          border: "1px solid #1e3a5f",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <Link
          href="/"
          style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}
        >
          ← 返回首页
        </Link>
        <h1 style={{ fontSize: 20, margin: "16px 0 8px", fontWeight: 600 }}>
          🔒 {title}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
          市场笔记、播客与 Risk 页面需验证后继续。可使用口令 <strong>fs123</strong> 或{" "}
          <strong>cd123</strong>（任一口令均可）。
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="密码"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setWrong(false);
            }}
            style={inputStyle}
          />
          {wrong && (
            <p style={{ color: "#f87171", fontSize: 13, marginTop: -8, marginBottom: 12 }}>
              密码错误
            </p>
          )}
          <button type="submit" style={btnStyle}>
            进入
          </button>
        </form>
      </div>
    </div>
  );
}
