"use client";

import { motion } from "framer-motion";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Anchor,
  Flame,
  Landmark,
  Radar,
  ShieldAlert,
  Sparkles,
  Telescope,
  TrendingDown,
  Waves,
} from "lucide-react";
import { SectionHeader } from "@/components/strategy/SectionHeader";
import { US_STRATEGY } from "@/data/publicUsStrategy";
import { pct } from "@/data/publicStrategy";

const AMBER_GLOW = "0 0 24px rgba(245,158,11,0.35)";

function TrackCard({
  icon: Icon,
  label,
  tagline,
  winRate,
  alphaWinRate,
  avg4Q,
  avgAlpha,
  delay,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  tagline: string;
  winRate: number;
  alphaWinRate: number;
  avg4Q: number;
  avgAlpha: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
      className="glass-panel p-5 transition-shadow hover:shadow-[0_0_30px_rgba(245,158,11,0.20)]"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-amber-400" strokeWidth={1.7} />
        <div>
          <div className="text-base font-semibold text-slate-100">{label}</div>
          <div className="text-[11px] text-slate-500">{tagline}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            胜率
          </div>
          <div className="num mt-1 text-xl font-bold text-amber-300 sm:text-2xl">
            {pct(winRate, 1)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">4Q 收益为正</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            平均 4Q 收益
          </div>
          <div className="num mt-1 text-xl font-bold text-amber-300 sm:text-2xl">
            {pct(avg4Q, 1)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            超额胜率 {pct(alphaWinRate, 0)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            平均 4Q 超额
          </div>
          <div className="num mt-1 text-xl font-bold text-amber-300 sm:text-2xl">
            {pct(avgAlpha, 1)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">vs SPY</div>
        </div>
      </div>
    </motion.div>
  );
}

export function WhaleTrailTab() {
  const d = US_STRATEGY;
  const { A, B } = d.tracks;
  const hlIcons = [Sparkles, Flame, TrendingDown, Landmark];

  return (
    <div>
      {/* ---- Tab 内 Hero ---- */}
      <section className="px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Waves className="h-5 w-5 text-amber-400" strokeWidth={1.7} />
              </span>
              <div>
                <h2
                  className="font-display text-3xl font-bold text-amber-300 sm:text-4xl"
                  style={{ textShadow: AMBER_GLOW }}
                >
                  巨鲸追踪 · WhaleTrail
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  美股 13F 机构资金跟踪 · 跟着美国机构资金的脚印
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 grid gap-3 sm:grid-cols-2"
          >
            <div className="glass-panel p-4 transition-shadow hover:shadow-[0_0_22px_rgba(245,158,11,0.15)]">
              <Anchor className="h-5 w-5 text-amber-400" strokeWidth={1.6} />
              <div className="mt-2 text-sm font-semibold text-slate-100">
                轨道一 · 物理瓶颈产业链
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">
                电网、核电、热管理、核燃料、数据中心 REIT、储能——有物理产能
                约束的链条，需求起来时供给跟不上，机构共识在这里最容易兑现。
              </div>
            </div>
            <div className="glass-panel p-4 transition-shadow hover:shadow-[0_0_22px_rgba(245,158,11,0.15)]">
              <Radar className="h-5 w-5 text-amber-400" strokeWidth={1.6} />
              <div className="mt-2 text-sm font-semibold text-slate-100">
                轨道二 · 全市场雷达
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">
                同一套「机构共识在买 + 估值还没被炒贵」的标准，不限行业，
                在全市场八千余家发行人的披露里扫描。
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rise/30 bg-rise/[0.08] px-4 py-2.5 text-xs text-rise sm:text-sm"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            本页全部数字为历史回测结果，非实盘业绩，不构成任何投资建议。
          </motion.div>
        </div>
      </section>

      {/* ---- 业绩卡 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="TRACK RECORD"
            title="双轨历史表现"
            desc="2020–2024 年发出的全部信号，统一规则：披露截止日次日买入、持有满 4 个季度。收益与超额均为信号等权平均。"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <TrackCard
              icon={Anchor}
              label={A.label}
              tagline="行业集中 · 主题清晰"
              winRate={A.winRate}
              alphaWinRate={A.alphaWinRate}
              avg4Q={A.avg4Q}
              avgAlpha={A.avgAlpha}
              delay={0.05}
            />
            <TrackCard
              icon={Radar}
              label={B.label}
              tagline="行业分散 · 标准统一"
              winRate={B.winRate}
              alphaWinRate={B.alphaWinRate}
              avg4Q={B.avg4Q}
              avgAlpha={B.avgAlpha}
              delay={0.15}
            />
          </div>
        </div>
      </section>

      {/* ---- 分年对照表 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="YEAR BY YEAR"
            title="分年表现对照"
            desc="按信号发出年份分组。SPY 列为当年日历年收益，作环境对照。"
          />
          <div className="glass-panel overflow-x-auto p-3 sm:p-5">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] text-slate-500">
                  <th className="py-2 pr-3 text-left font-medium">年份</th>
                  <th className="py-2 pr-3 text-right font-medium">SPY 当年</th>
                  <th className="py-2 pr-3 text-right font-medium" colSpan={3}>
                    <span className="text-amber-400/80">物理瓶颈</span>
                  </th>
                  <th className="py-2 text-right font-medium" colSpan={3}>
                    <span className="text-sky-400/80">全市场雷达</span>
                  </th>
                </tr>
                <tr className="border-b border-white/[0.08] text-[10px] text-slate-600">
                  <th className="py-1.5 pr-3 text-left font-medium" />
                  <th className="py-1.5 pr-3 text-right font-medium" />
                  <th className="py-1.5 pr-3 text-right font-medium">4Q 收益</th>
                  <th className="py-1.5 pr-3 text-right font-medium">4Q 超额</th>
                  <th className="py-1.5 pr-3 text-right font-medium">超额胜率</th>
                  <th className="py-1.5 pr-3 text-right font-medium">4Q 收益</th>
                  <th className="py-1.5 pr-3 text-right font-medium">4Q 超额</th>
                  <th className="py-1.5 text-right font-medium">超额胜率</th>
                </tr>
              </thead>
              <tbody>
                {d.yearly.map((r) => (
                  <tr
                    key={r.year}
                    className="border-b border-white/[0.05] text-slate-300 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="num py-2.5 pr-3 font-semibold text-slate-100">
                      {r.year}
                    </td>
                    <td
                      className={`num py-2.5 pr-3 text-right ${
                        r.spyReturn < 0 ? "text-fall" : "text-slate-400"
                      }`}
                    >
                      {pct(r.spyReturn, 1)}
                    </td>
                    <td className="num py-2.5 pr-3 text-right">{pct(r.aAvg4Q, 1)}</td>
                    <td className="num py-2.5 pr-3 text-right">{pct(r.aAlpha, 1)}</td>
                    <td className="num py-2.5 pr-3 text-right text-slate-400">
                      {pct(r.aAlphaWin, 0)}
                    </td>
                    <td className="num py-2.5 pr-3 text-right">{pct(r.bAvg4Q, 1)}</td>
                    <td className="num py-2.5 pr-3 text-right">{pct(r.bAlpha, 1)}</td>
                    <td className="num py-2.5 text-right text-slate-400">
                      {pct(r.bAlphaWin, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              策略在「成长股承压 + 实物/基建/电力叙事」阶段（如 2022–2023）
              弹性最大；普涨但风格不利的年份（如 2021）绝对收益收敛，超额仍为正。
            </p>
          </div>
        </div>
      </section>

      {/* ---- 大盘下跌年份 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="STRESS TEST"
            title="大盘下跌年份的表现"
            desc="样本期内 SPY 日历年收益为负的只有 2022 年（-18.65%）。该年发出的信号持有 4 个季度后："
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "SPY 当年收益", v: pct(d.downYear.spyReturn, 1), neg: true },
              {
                label: "物理瓶颈 · 平均 4Q 收益",
                v: pct(d.downYear.aAvg4Q, 1),
                sub: `超额 ${pct(d.downYear.aAlpha, 1)} · 超额胜率 ${pct(d.downYear.aAlphaWin, 0)}`,
              },
              {
                label: "全市场雷达 · 平均 4Q 收益",
                v: pct(d.downYear.bAvg4Q, 1),
                sub: `超额 ${pct(d.downYear.bAlpha, 1)} · 超额胜率 ${pct(d.downYear.bAlphaWin, 0)}`,
              },
            ].map((c) => (
              <motion.div
                key={c.label}
                whileHover={{ y: -4 }}
                className="glass-panel p-5 transition-shadow hover:shadow-[0_0_28px_rgba(245,158,11,0.18)]"
              >
                <div className="text-[11px] uppercase tracking-wider text-slate-500">
                  {c.label}
                </div>
                <div
                  className={`num mt-2 text-3xl font-bold ${
                    c.neg ? "text-fall" : "text-amber-300"
                  }`}
                >
                  {c.v}
                </div>
                {c.sub && (
                  <div className="mt-1 text-[11px] text-slate-500">{c.sub}</div>
                )}
              </motion.div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            单一年份、信号等权平均，不构成对未来下跌市的承诺；但「机构共识 +
            估值未贵」的组合在系统性下跌中展现了相对防御性。
          </p>
        </div>
      </section>

      {/* ---- 季度亮点 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="LATEST QUARTER"
            title={`${d.meta.quarter} 季度亮点`}
            desc="最新披露季的机构资金全景：名单来自 SEC 公开披露，可公开核验。"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {d.quarterHighlights.map((h, i) => {
              const Icon = hlIcons[i % hlIcons.length];
              return (
                <motion.div
                  key={h.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                  className="glass-panel p-5 transition-shadow hover:shadow-[0_0_24px_rgba(245,158,11,0.16)]"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-amber-400" strokeWidth={1.7} />
                    <h3 className="text-base font-semibold text-slate-100">
                      {h.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {h.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- 逻辑散文 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader eyebrow="HOW IT WORKS" title="它怎么选（可公开的部分）" />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                t: "数据：SEC 公开披露",
                d: "美国证监会要求管理一定规模以上股票资产的机构每季度公布持仓（13F）。我们只统计「连续两个季度都披露、且都交易同一只股票」的机构，避免把新进小机构与长持大机构混为一谈。",
              },
              {
                t: "筛选：共识在买，且没炒贵",
                d: "一看方向：一批「两季都在」的机构是否整体净买入，多空分歧大或信号模糊的一律剔除；二看估值：用行业长期增长假设反推当前股价隐含的预期，已经把故事打满的不碰。两个条件同时满足才入名单。",
              },
              {
                t: "执行：披露次日买入，拿满一年",
                d: "以当季 13F 法定披露截止日为信号日，次日（遇周末顺延）按收盘价买入，连续持有 4 个季度，统计绝对收益与相对 SPY 的超额。",
              },
              {
                t: "不做的事",
                d: "不预测单日涨跌、不保证单只必涨、不加杠杆、不做日内；名单只是「机构共识 + 估值未贵」的历史统计结果，不替代你自己的功课与风险判断。",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(245,158,11,0.12)]"
              >
                <Telescope className="h-5 w-5 text-amber-400" strokeWidth={1.6} />
                <h3 className="mt-3 text-base font-semibold text-slate-100">
                  {c.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 风险披露 ---- */}
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
                <li>
                  <strong className="text-slate-100">回测非实盘。</strong>
                  全部数字来自历史信号的规则化统计，未计入交易成本、冲击成本
                  与滑点；T+1 收盘成交是理想化假设，过去表现不预示未来。
                </li>
                <li>
                  <strong className="text-slate-100">信号等权 ≠ 组合收益。</strong>
                  展示的是单信号持有 4 季度的平均表现，不是一条可投资净值
                  曲线；信号集中在特定主题时，实际组合波动会更大。
                </li>
                <li>
                  <strong className="text-slate-100">行业集中风险。</strong>
                  物理瓶颈轨高度集中于电力/基建链条，宏观或政策转向（资本
                  开支推迟、利率长期高企）会使板块同步承压。
                </li>
                <li>
                  <strong className="text-slate-100">披露时滞。</strong>
                  13F 持仓最长滞后 45 天披露，机构可能已反向操作；跟随披露
                  交易天然慢半拍。
                </li>
                <li>
                  <strong className="text-slate-100">样本期有限。</strong>
                  信号样本仅覆盖 2020–2024，且恰逢 AI/电力叙事大年，存在
                  强烈的时代烙印，无真正样本外检验。
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            {d.meta.dataNote} · 数据来源：{d.source} · 历史回测，非实盘业绩，
            不构成投资建议
          </p>
        </div>
      </section>
    </div>
  );
}
