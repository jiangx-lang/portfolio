"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  Crosshair,
  DoorOpen,
  ListChecks,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { StrategyNavChart } from "@/components/strategy/StrategyNavChart";
import { SectionHeader } from "@/components/strategy/SectionHeader";
import { STRATEGY, num, pct } from "@/data/publicStrategy";

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="glass-panel p-4 transition-shadow hover:shadow-[0_0_28px_rgba(16,185,129,0.18)] sm:p-5"
    >
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="num mt-2 text-2xl font-bold text-emerald-300 sm:text-3xl">
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </motion.div>
  );
}

export function ReviveTab() {
  const r = STRATEGY.root;
  const s = STRATEGY.sources;

  return (
    <div>
      {/* ---- 1. Hero ---- */}
      <section className="px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <Sprout className="h-5 w-5 text-emerald-400" strokeWidth={1.7} />
              </span>
              <div>
                <h2
                  className="font-display text-3xl font-bold text-emerald-300 sm:text-4xl"
                  style={{ textShadow: "0 0 24px rgba(16,185,129,0.35)" }}
                >
                  枯木逢春 · Revive
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  在被市场遗忘的中小盘老公司里，寻找财报业绩刚拐头的瞬间
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rise/30 bg-rise/[0.08] px-4 py-2.5 text-xs text-rise sm:text-sm"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            本页全部数字为历史回测结果，非实盘业绩，不构成任何投资建议。
          </motion.div>
        </div>
      </section>

      {/* ---- 2. 成绩卡 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="CURRENT BEST"
            title="当前最优解 · 成绩"
            desc={`回测区间 ${STRATEGY.meta.backtestStart} 至 ${STRATEGY.meta.dataEnd}，费用与滑点已计入 · 更新日期 ${STRATEGY.meta.updatedOn}`}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="年化收益率" value={pct(r.cagr, 1)} sub="费后" />
            <KpiCard label="夏普比率" value={num(r.sharpe)} sub="日收益年化" />
            <KpiCard label="最大回撤" value={pct(r.maxDD, 1)} sub="全程最深" />
            <KpiCard
              label="期末净值"
              value={`${num(r.finalNav / 10000, 1)} 万`}
              sub={`20 万起步 · 累计 ${num(r.multiple, 1)}×`}
            />
          </div>

          {/* 3. 一句话定义 */}
          <div className="mt-6 flex flex-wrap gap-2">
            {STRATEGY.definition.map((d) => (
              <span
                key={d}
                className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-1.5 text-xs text-emerald-200/90"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 4. 净值曲线 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="EQUITY CURVE"
            title="净值曲线与回撤"
            desc="Root 根本版 vs 全市场等权基准（策略可投池内等权）。"
          />
          <div className="glass-panel p-3 sm:p-5">
            <StrategyNavChart />
          </div>
        </div>
      </section>

      {/* ---- 5. 收益从哪来 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader eyebrow="WHERE IT COMES FROM" title="收益从哪来" />
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]"
            >
              <LogIn className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">进场</h3>
              <div className="num mt-2 text-2xl font-bold text-emerald-300">
                {pct(s.entry.shareBuys, 1)}
                <span className="mx-1 text-sm text-slate-500">的买入挣走</span>
                {pct(s.entry.contribShare, 1)}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.entry.text}
              </p>
            </motion.div>
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]"
            >
              <LogOut className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">出场</h3>
              <div className="mt-2 space-y-1 text-sm">
                <div className="num text-emerald-300">
                  止盈（已删规则·存档） {s.exit.tpN.toLocaleString()} 笔 · +{num(s.exit.tpPnlWan, 0)} 万
                </div>
                <div className="num text-slate-400">
                  衰减离场 {s.exit.decayN.toLocaleString()} 笔 · {num(s.exit.decayPnlWan, 0)} 万
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.exit.text}
              </p>
            </motion.div>
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]"
            >
              <CalendarClock className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">时代</h3>
              <div className="mt-2 space-y-1 text-sm">
                <div className="num text-emerald-300">
                  2025 年 {pct(s.eras.y2025, 1)}
                </div>
                <div className="num text-rise">
                  2026 年 {pct(s.eras.y2026, 1)}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.eras.text}
              </p>
            </motion.div>
          </div>

          {/* 6. 验证角标 */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-xs leading-relaxed text-emerald-200/90 sm:text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.8} />
            {STRATEGY.verification}
          </div>
        </div>
      </section>

      {/* ---- 7. 风险三条 ---- */}
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader eyebrow="RISK DISCLOSURE" title="风险披露" />
          <div className="glass-panel border-rise/20 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="mt-0.5 h-5 w-5 shrink-0 text-rise"
                strokeWidth={1.6}
              />
              <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
                {STRATEGY.risks.map((t) => (
                  <li key={t.slice(0, 10)}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          {/* 8. 页脚 */}
          <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <ListChecks className="h-3.5 w-3.5 text-emerald-500/70" strokeWidth={1.8} />
            本页只展示当前最优解，随研究进展不定期更新 · 最近更新{" "}
            {STRATEGY.meta.updatedOn} · 历史回测，非实盘业绩，不构成投资建议
          </p>
        </div>
      </section>
    </div>
  );
}
