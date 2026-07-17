"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  FileText,
  Globe,
  Landmark,
  Podcast,
} from "lucide-react";

type SignalEntry = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

const ENTRIES: SignalEntry[] = [
  {
    href: "/qd",
    icon: Globe,
    title: "QDII AI 信号",
    desc: "境外 QDII 基金的 AI 信号与持仓透视，把握全球配置脉络。",
  },
  {
    href: "/mrf",
    icon: Landmark,
    title: "MRF AI 信号",
    desc: "香港互认基金的 AI 信号与净值跟踪，洞悉跨境配置机会。",
  },
  {
    href: "/notes",
    icon: FileText,
    title: "市场笔记",
    desc: "宏观与市场的每日观察、研究笔记与长图报告归档。",
  },
  {
    href: "/podcast",
    icon: Podcast,
    title: "播客",
    desc: "投研播客与音频解读，随时随地收听市场观点。",
  },
];

export default function SignalsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6">
      <header className="mb-10">
        <span className="eyebrow">SIGNAL CENTER · LV4 专属</span>
        <h1 className="font-display mt-2 text-4xl font-bold sm:text-5xl">
          <span className="text-gradient-gold">信号中心</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          汇聚站内全部信号入口——AI 信号、市场笔记与播客，一站直达。
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="glass-card group animate-in block p-6 sm:p-7"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-gold/10">
              <e.icon className="h-5 w-5 text-gold" />
            </div>
            <h2 className="font-display mt-5 text-xl font-bold">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {e.desc}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
              进入
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <hr className="hairline-gold mt-14" />
      <p className="mt-6 text-center text-xs text-slate-500">
        更多信号能力持续开放中
      </p>
    </div>
  );
}
