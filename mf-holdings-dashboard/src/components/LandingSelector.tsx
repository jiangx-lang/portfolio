"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Landmark,
  Globe,
  LineChart,
  PieChart,
  FileText,
  Podcast,
  Shield,
  Radio,
  Lock,
  ArrowRight,
  Crown,
  BookOpen,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { type FeatureKey } from "@/lib/progress";
import KimiK3Banner from "@/components/KimiK3Banner";

interface ProgressData {
  username?: string;
  xp: number;
  level: number;
  levelName: string;
}

interface Entry {
  /** 站内功能才有 key（用于 XP 门禁）；外链入口省略 */
  key?: FeatureKey;
  tag: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  accent?: boolean;
  /** 外链新窗口打开，不参与 XP 门禁 */
  external?: boolean;
}

/** 大方块：内容与情报 */
const featuredEntries: Entry[] = [
  {
    tag: "US MARKET CHRONICLE",
    title: "美股编年史",
    desc: "百年美股回报 · 估值周期 · 回撤档案（站内镜像）",
    icon: BookOpen,
    href: "/chronicle",
    accent: true,
  },
  {
    key: "notes",
    tag: "DAILY REPORTS · PDF",
    title: "PDF 阅读",
    desc: "每日市场报告 · 站内沉浸式 PDF 阅读",
    icon: FileText,
    href: "/notes",
  },
  {
    key: "podcast",
    tag: "AUDIO",
    title: "播客",
    desc: "投研音频解读 · 随时随地收听市场观点",
    icon: Podcast,
    href: "/podcast",
  },
];

/** 小方块：工具与信号 */
const toolEntries: Entry[] = [
  {
    key: "qd",
    tag: "QDII FUND POOL",
    title: "QDII 基金池",
    desc: "组合构建 · 主题搜索 · 历史业绩回溯",
    icon: Landmark,
    href: "/qd",
  },
  {
    key: "mrf",
    tag: "MRF PORTFOLIO",
    title: "MRF 互认基金",
    desc: "基金池筛选 · 组合构建 · 持仓穿透分析",
    icon: Globe,
    href: "/mrf",
  },
  {
    key: "wmp",
    tag: "WMP NAV",
    title: "WMP 理财",
    desc: "净值抓取 · 走势追踪 · 收益对比",
    icon: LineChart,
    href: "/wmp",
  },
  {
    key: "portfolio",
    tag: "MODEL PORTFOLIO",
    title: "标准组合",
    desc: "手续费测算 · 组合诊断 · 情景分析",
    icon: PieChart,
    href: "/portfolio",
  },
  {
    key: "risk",
    tag: "RISK",
    title: "风险监控",
    desc: "交互式宏观风险仪表板",
    icon: Shield,
    href: "/risk",
  },
  {
    key: "signals",
    tag: "SIGNALS",
    title: "信号中心",
    desc: "宏观 / 行业 / 个股 AI 信号",
    icon: Radio,
    href: "/signals",
  },
];

const requiredLevels: Record<FeatureKey, number> = {
  qd: 1,
  mrf: 1,
  wmp: 1,
  notes: 1,
  podcast: 1,
  portfolio: 2,
  stock: 2,
  ai_summary: 2,
  risk: 3,
  deep_analysis: 3,
  signals: 4,
  pdf_export: 4,
};

const entrance = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: "easeOut" as const },
});

export default function LandingSelector() {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    fetch("/api/progress/me")
      .then((r) => r.json())
      .then((data) => setProgress(data as ProgressData))
      .catch(() => {});
  }, []);

  const userLevel = progress?.level ?? 1;

  const renderBigCard = (entry: Entry, index: number) => {
    const required = entry.key ? requiredLevels[entry.key] : 1;
    const locked = !entry.external && userLevel < required;
    const Icon = entry.icon;

    const card = (
      <div
        className={`glass-card group relative h-full flex flex-col p-6 overflow-hidden ${
          entry.accent && !locked ? "glow-border" : ""
        } ${locked ? "opacity-60 saturate-50 pb-12" : ""}`}
      >
        {locked && (
          <span className="badge badge-gold absolute top-4 right-4 z-10">
            <Lock className="w-3 h-3" />
            Lv.{required} 解锁
          </span>
        )}
        <div className="w-12 h-12 rounded-full bg-gold/[0.08] border border-gold/25 flex items-center justify-center text-gold shadow-glow-gold mb-5">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
          {entry.tag}
        </span>
        <h3 className="font-display text-xl font-bold text-white mt-1.5">
          {entry.title}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed mt-2 flex-1">
          {entry.desc}
        </p>
        <div className="mt-5 flex items-center text-sm font-medium text-gold-light">
          {locked ? "去获取 XP" : "进入"}
          {entry.external ? (
            <ExternalLink className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          ) : (
            <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          )}
        </div>
        {locked && (
          <div className="absolute inset-x-0 bottom-0 py-2.5 text-center text-xs text-gold-light bg-navy/70 backdrop-blur-sm border-t border-gold/20 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
            再多使用几次即可开启
          </div>
        )}
      </div>
    );

    return (
      <motion.div
        key={entry.key ?? entry.title}
        {...entrance(0.16 + index * 0.06)}
        className="h-full"
      >
        {entry.external ? (
          <a
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full"
          >
            {card}
          </a>
        ) : (
          <Link href={locked ? "/qd" : entry.href} className="block h-full">
            {card}
          </Link>
        )}
      </motion.div>
    );
  };

  const renderSmallCard = (entry: Entry, index: number) => {
    const required = entry.key ? requiredLevels[entry.key] : 1;
    const locked = userLevel < required;
    const Icon = entry.icon;

    return (
      <motion.div
        key={entry.key ?? entry.title}
        {...entrance(0.34 + index * 0.05)}
        className="h-full"
      >
        <Link href={locked ? "/qd" : entry.href} className="block h-full">
          <div
            className={`glass-card group h-full flex items-center gap-3.5 px-4 py-3.5 ${
              locked ? "opacity-60 saturate-50" : ""
            }`}
          >
            <div className="w-9 h-9 shrink-0 rounded-full bg-gold/[0.08] border border-gold/20 flex items-center justify-center text-gold">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                {entry.title}
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {locked ? (
                  <>
                    <span className="group-hover:hidden">{entry.desc}</span>
                    <span className="hidden group-hover:inline text-gold-light">
                      再多使用几次即可开启
                    </span>
                  </>
                ) : (
                  entry.desc
                )}
              </div>
            </div>
            {locked ? (
              <span className="badge badge-gold shrink-0">
                <Lock className="w-3 h-3" />
                Lv.{required} 解锁
              </span>
            ) : (
              <ArrowRight className="w-4 h-4 shrink-0 text-slate-500 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-gold-light" />
            )}
          </div>
        </Link>
      </motion.div>
    );
  };

  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
      {/* Hero */}
      <motion.header {...entrance(0)} className="relative text-center">
        {/* 顶部环境光晕 */}
        <div
          aria-hidden
          className="hero-glow pointer-events-none absolute -top-40 left-1/2 -z-10 h-[460px] w-[760px] -translate-x-1/2 rounded-full opacity-80"
        />
        <span className="eyebrow">ATLAS MARKET PORTFOLIO</span>
        <h1 className="font-display text-balance text-[2.6rem] leading-[1.1] sm:text-6xl lg:text-7xl font-bold mt-5 tracking-wide">
          全资产<span className="text-gradient-gold">投研</span>工作台
        </h1>
        <div className="ornament mx-auto mt-7 max-w-[220px]">
          <span className="text-[10px]">✦</span>
        </div>
        <p className="text-sm sm:text-base text-slate-400 mt-6 max-w-xl mx-auto leading-relaxed">
          持仓透视 · 净值追踪 · AI 信号，一站式纵览全球资产
        </p>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.42em] text-slate-500">
          Research · Signals · Portfolio
        </p>
        {progress && (
          <div className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full glass-panel">
            <Crown className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold text-gold-light">
              Lv.{progress.level} · {progress.levelName}
            </span>
            <span className="w-px h-3.5 bg-white/10" />
            <span className="num text-xs text-slate-400">{progress.xp} XP</span>
          </div>
        )}
        {/* 数据规模 */}
        <div className="mx-auto mt-9 grid max-w-lg grid-cols-3 divide-x divide-white/[0.07]">
          {[
            ["141", "只 QDII 基金"],
            ["87", "章美股编年史"],
            ["92", "个数据集 · 每日同步"],
          ].map(([n, label]) => (
            <div key={label} className="px-2">
              <div className="num text-xl sm:text-2xl font-semibold text-gold-light">
                {n}
              </div>
              <div className="mt-1 text-[10px] sm:text-[11px] tracking-wider text-slate-500">
                {label}
              </div>
            </div>
          ))}
        </div>
      </motion.header>

      {/* Kimi K3 美学横幅 */}
      <motion.div {...entrance(0.1)} className="max-w-3xl mx-auto mt-10">
        <KimiK3Banner />
      </motion.div>

      {/* 大方块：资讯与情报 */}
      <motion.div {...entrance(0.14)} className="mt-12">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
            资讯与情报
          </span>
          <span className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredEntries.map((entry, i) => renderBigCard(entry, i))}
        </div>
      </motion.div>

      {/* 小方块：核心工作台 */}
      <div className="mt-10">
        <motion.div {...entrance(0.3)} className="flex items-center gap-4 mb-4">
          <span className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
            核心工作台
          </span>
          <span className="flex-1 h-px bg-white/[0.06]" />
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {toolEntries.map((entry, i) => renderSmallCard(entry, i))}
          {renderSmallCard(
            {
              tag: "ADMIN",
              title: "管理后台",
              desc: "内容上传 · 数据统计",
              icon: Lock,
              href: "/admin",
            },
            toolEntries.length
          )}
        </div>
      </div>

      {/* 页脚 */}
      <motion.footer {...entrance(0.5)} className="mt-16">
        <hr className="hairline-gold" />
        <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
          数据仅供研究参考，不构成投资建议 · 投资涉及风险，决策需谨慎
        </p>
      </motion.footer>
    </div>
  );
}
