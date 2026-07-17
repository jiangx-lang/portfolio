"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

type Props = {
  /** 错误页标题 */
  title: string;
  /** 补充说明（如 error.message），可省略 */
  description?: string;
  /** Next.js error boundary 的 reset 回调 */
  reset: () => void;
};

export default function ErrorView({ title, description, reset }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="glass-card animate-in w-full max-w-md p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/25 bg-gold/10 shadow-glow-gold">
          <AlertTriangle className="h-6 w-6 text-gold" />
        </div>
        <h2 className="font-display mt-6 text-xl font-bold sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 break-words text-sm leading-relaxed text-slate-400">
            {description}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-gold">
            <RefreshCw className="h-4 w-4" />
            重试
          </button>
          <Link href="/" className="btn-ghost">
            <Home className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
