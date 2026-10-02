"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Radar, Sprout } from "lucide-react";
import { ReviveTab } from "@/components/strategy/ReviveTab";
import { WhaleTrailTab } from "@/components/strategy/WhaleTrailTab";

type TabKey = "revive" | "whale";

const TABS: {
  key: TabKey;
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  en: string;
  tagline: string;
  accentText: string;
  activeCls: string;
  glow: string;
}[] = [
  {
    key: "revive",
    icon: Sprout,
    title: "枯木逢春",
    en: "REVIVE · A股困境反转",
    tagline: "在被遗忘的中小盘老公司里，找财报业绩刚拐头的瞬间",
    accentText: "text-emerald-400",
    activeCls:
      "border-emerald-500/50 bg-emerald-500/[0.07] shadow-[0_0_36px_rgba(16,185,129,0.22)]",
    glow: "group-hover:shadow-[0_0_28px_rgba(16,185,129,0.18)]",
  },
  {
    key: "whale",
    icon: Radar,
    title: "巨鲸追踪",
    en: "WHALETRAIL · 美股13F",
    tagline: "跟着美国机构资金的脚印：共识在买，且估值还没被炒贵",
    accentText: "text-amber-400",
    activeCls:
      "border-amber-500/50 bg-amber-500/[0.07] shadow-[0_0_36px_rgba(245,158,11,0.22)]",
    glow: "group-hover:shadow-[0_0_28px_rgba(245,158,11,0.18)]",
  },
];

export default function StrategyPage() {
  const [tab, setTab] = useState<TabKey>("revive");

  return (
    <div className="flex min-h-screen flex-col bg-navy">
      {/* ============ 频道 Hero ============ */}
      <header className="relative overflow-hidden border-b border-white/[0.07] px-4 pb-10 pt-20 sm:px-6 sm:pb-12 sm:pt-24">
        {/* 深空渐变底 + 双色辉光 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #020617 0%, #05070D 70%, #05070D 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(640px 300px at 18% 0%, rgba(16,185,129,0.12), transparent 65%)," +
              "radial-gradient(640px 300px at 82% 0%, rgba(245,158,11,0.10), transparent 65%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow">ATLAS STRATEGIES</span>
            <h1 className="font-display mt-3 text-4xl font-bold leading-tight sm:text-6xl">
              <span
                className="bg-gradient-to-r from-emerald-300 via-gold-light to-amber-300 bg-clip-text text-transparent"
                style={{ filter: "drop-shadow(0 0 26px rgba(201,168,76,0.30))" }}
              >
                星图策略
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              中美双市场量化策略频道——A 股找困境反转的春芽，美股跟随机构
              巨鲸的尾流。全部参数隐去，只展示逻辑与结果。
            </p>
          </motion.div>

          {/* ---- 双 Tab 卡片 ---- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 grid gap-4 sm:grid-cols-2"
            role="tablist"
            aria-label="策略切换"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <motion.button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  className={`group glass-panel relative overflow-hidden p-5 text-left transition-shadow duration-300 ${
                    active
                      ? t.activeCls
                      : `border-white/[0.07] ${t.glow}`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
                        active
                          ? "border-current/30 bg-white/[0.04]"
                          : "border-white/[0.08] bg-white/[0.02]"
                      } ${t.accentText}`}
                    >
                      <t.icon className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <div>
                      <div className="font-display text-xl font-bold text-slate-100">
                        {t.title}
                      </div>
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${t.accentText}`}
                      >
                        {t.en}
                      </div>
                    </div>
                    {active && (
                      <motion.span
                        layoutId="strategy-tab-dot"
                        className={`ml-auto h-2 w-2 rounded-full ${
                          t.key === "revive" ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                        style={{
                          boxShadow:
                            t.key === "revive"
                              ? "0 0 12px rgba(16,185,129,0.9)"
                              : "0 0 12px rgba(245,158,11,0.9)",
                        }}
                      />
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {t.tagline}
                  </p>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </header>

      {/* ============ Tab 内容 ============ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          {tab === "revive" ? <ReviveTab /> : <WhaleTrailTab />}
        </motion.div>
      </AnimatePresence>

      {/* ============ 页脚 ============ */}
      <footer className="border-t border-white/[0.07] px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>星图策略 · Atlas Strategies —— 历史回测展示，非实盘业绩，不构成投资建议</p>
          <Link href="/" className="btn-ghost">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </Link>
        </div>
      </footer>
    </div>
  );
}
