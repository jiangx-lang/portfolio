"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";

/** 仅用于 /risk；任一口令均可解锁本会话内该页 */
const VALID_PASSWORDS = new Set(["fs123", "cd123"]);
const STORAGE_UNLOCKED = "atlas_gate_risk_v1";

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-16">
      <div className="glass-panel glow-border animate-in w-full max-w-md p-8 sm:p-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </Link>

        <div className="mt-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/25 bg-gold/10 shadow-glow-gold">
            <Lock className="h-7 w-7 text-gold" />
          </div>
          <span className="eyebrow mt-6">PRIVATE ACCESS</span>
          <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            本页（宏观风险监控）需验证后继续。可使用口令{" "}
            <span className="font-mono text-gold-light">fs123</span> 或{" "}
            <span className="font-mono text-gold-light">cd123</span>
            （任一口令均可）。管理员后台请使用{" "}
            <Link
              href="/admin"
              className="text-info transition-colors hover:text-gold-light"
            >
              /admin
            </Link>{" "}
            独立密码。
          </p>
        </div>

        <form onSubmit={submit} className="mt-8">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="请输入访问口令"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setWrong(false);
            }}
            className="w-full rounded-xl border border-white/[0.07] bg-navy-card px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-gold/60"
          />
          {wrong && (
            <p className="mt-3 text-xs text-rise">口令有误，请重新输入</p>
          )}
          <button type="submit" className="btn-gold mt-5 w-full">
            进入
          </button>
        </form>
      </div>
    </div>
  );
}
