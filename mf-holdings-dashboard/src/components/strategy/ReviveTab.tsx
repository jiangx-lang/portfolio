"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Crosshair,
  FilterX,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Sprout,
} from "lucide-react";
import { StrategyNavChart } from "@/components/strategy/StrategyNavChart";
import { VariantGrid } from "@/components/strategy/VariantGrid";
import { MonthlyHeatmap } from "@/components/strategy/MonthlyHeatmap";
import { SectionHeader } from "@/components/strategy/SectionHeader";
import { STRATEGY, num, pct } from "@/data/publicStrategy";

const EMERALD_GLOW = "0 0 24px rgba(16,185,129,0.35)";

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
  const a = STRATEGY.active;

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
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <Sprout className="h-5 w-5 text-emerald-400" strokeWidth={1.7} />
              </span>
              <div>
                <h2
                  className="font-display text-3xl font-bold text-emerald-300 sm:text-4xl"
                  style={{ textShadow: EMERALD_GLOW }}
                >
                  枯木逢春 · Revive
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  A 股困境反转 · 在被市场遗忘的中小盘老公司里，寻找财报业绩刚刚拐头的瞬间
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 grid gap-3 sm:grid-cols-3"
          >
            {[
              {
                icon: FilterX,
                t: "不预测，只排除",
                d: "不猜市场方向，只系统性地排除追高与不符合条件的标的。",
              },
              {
                icon: Crosshair,
                t: "赚困境拐头的钱",
                d: "利润主要来自扭亏型公司——市场对困境拐点的反应总是迟钝。",
              },
              {
                icon: RefreshCw,
                t: "纪律驱动，每日执行",
                d: "每日扫描、条件触发：财报业绩拐点强度排名显著恶化时卖出，大盘跌破长期均线时收缩仓位。",
              },
            ].map(({ icon: Icon, t, d }) => (
              <motion.div
                key={t}
                whileHover={{ y: -3 }}
                className="glass-panel p-4 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.15)]"
              >
                <Icon className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  {t}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">
                  {d}
                </div>
              </motion.div>
            ))}
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

      {/* ---- KPI ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="KEY METRICS"
            title="现役版本一览"
            desc="2012 年 4 月至今的完整回测窗口，费用与滑点已计入。"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="年化收益率" value={pct(a.cagr, 1)} sub="费后" />
            <KpiCard label="夏普比率" value={num(a.sharpe)} sub="日收益年化" />
            <KpiCard
              label="最大回撤"
              value={pct(a.maxDD, 1)}
              sub="曾连续数年跑输，见风险披露"
            />
            <KpiCard
              label="累计倍数"
              value={`${num(a.multiple, 1)}×`}
              sub="回测期全程"
            />
          </div>
        </div>
      </section>

      {/* ---- 净值大图 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="EQUITY CURVE"
            title="净值曲线与回撤"
            desc="现役版本 vs 全市场等权基准（策略可投池内等权）vs 候选版本（线下全守档，未启用）。"
          />
          <div className="glass-panel p-3 sm:p-5">
            <StrategyNavChart />
          </div>
        </div>
      </section>

      {/* ---- 交互变体网格 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="VARIANT MATRIX"
            title="组合构建变体网格"
            desc="策略收益对两个组合构建维度的敏感性：持仓只数 × 大盘线下仓位档位。25 个变体在同一信号引擎下回测，用于展示结论的稳健性——信号逻辑完全一致，仅组合构建不同。"
          />
          <div className="glass-panel p-3 sm:p-5">
            <VariantGrid />
          </div>
        </div>
      </section>

      {/* ---- 月度热力表 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="MONTHLY RETURNS"
            title="月度收益热力表"
            desc="现役版本逐月费后收益。可以看到收益的分布并不均匀——它高度依赖困境反转标的的供给与市场环境。"
          />
          <div className="glass-panel p-3 sm:p-5">
            <MonthlyHeatmap />
          </div>
        </div>
      </section>

      {/* ---- 它买什么 ---- */}
      <section className="border-b border-white/[0.07] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader eyebrow="WHAT IT BUYS" title="它买什么" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]">
              <Landmark className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                被遗忘的老公司
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                典型画像是上市十几年的中小盘公司：中位市值约五十亿元，成交清淡，
                研究覆盖稀少，买入时股价大多还在阴跌。策略刻意不碰热门股与高
                动量股——那里没有它要的定价迟钝。
              </p>
            </div>
            <div className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]">
              <Crosshair className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                利润来自扭亏型公司
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                逐段解剖数千笔持仓：约八成半的利润来自上年同期亏损或微利、
                本期刚转正的「扭亏型」公司；低基数公司贡献其次。基数正常的真
                拐点组同样整体盈利——这不是单纯的数字游戏，而是市场对困境
                反转的系统性低估。
              </p>
            </div>
            <div className="glass-panel p-5 transition-shadow hover:shadow-[0_0_22px_rgba(16,185,129,0.12)]">
              <RefreshCw className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
              <h3 className="mt-3 text-base font-semibold text-slate-100">
                为什么这个钱存在
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                财报拐点公布后的两三周内，价格往往缓慢漂移而非一步定价——
                冷门股尤甚。策略按拐点强度排序持有，排名显著恶化即离场，
                用日度纪律把这种迟钝一寸寸收割下来。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 版本谱系 ---- */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <SectionHeader
            eyebrow="LINEAGE"
            title="版本谱系"
            desc="每一次改动都由一个可证伪的问题驱动：日历为什么重要、排名恶化多快该离场、观察频率多高才够。"
          />
          <div className="glass-panel overflow-x-auto p-3 sm:p-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">版本</th>
                  <th className="py-2 pr-3 font-medium">机制演进</th>
                  <th className="py-2 pr-3 text-right font-medium">年化收益</th>
                  <th className="py-2 pr-3 text-right font-medium">夏普比率</th>
                  <th className="py-2 pr-3 text-right font-medium">最大回撤</th>
                  <th className="py-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGY.versions.map((v) => (
                  <tr
                    key={v.version}
                    className={`border-b border-white/[0.05] ${
                      v.status === "现役"
                        ? "text-emerald-300"
                        : "text-slate-300"
                    }`}
                  >
                    <td className="num py-2.5 pr-3 font-semibold">
                      {v.version}
                    </td>
                    <td className="py-2.5 pr-3">{v.desc}</td>
                    <td className="num py-2.5 pr-3 text-right">
                      {pct(v.cagr, 1)}
                    </td>
                    <td className="num py-2.5 pr-3 text-right">
                      {num(v.sharpe)}
                    </td>
                    <td className="num py-2.5 pr-3 text-right">
                      {v.maxDD == null ? "—" : pct(v.maxDD, 1)}
                    </td>
                    <td className="py-2.5 text-right">
                      {v.status === "现役" ? (
                        <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[11px] text-emerald-400">
                          现役
                        </span>
                      ) : v.status === "候选" ? (
                        <span className="rounded border border-info/40 px-1.5 py-0.5 text-[11px] text-info">
                          候选
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {v.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              候选版本把「大盘线下收缩仓位」做到极致，历史数字显著更好，但它
              是参数扫描中的最优点、且使策略带择时属性——尚未启用，仅作对照。
            </p>
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
                  全部结果来自历史数据模拟，含费用与滑点假设；实盘存在冲击
                  成本、流动性与执行偏差，历史表现不预示未来。
                </li>
                <li>
                  <strong className="text-slate-100">回撤可能极深。</strong>
                  历史上最大回撤约 50%，极端情形（如 2015 年式闪崩）可能
                  更深；也曾出现连续数年的低迷期。
                </li>
                <li>
                  <strong className="text-slate-100">超额收益正在衰减。</strong>
                  2025 年以来，策略相对自身可投池的超额明显走弱，有两条相互
                  独立的证据支持这一结论；是拥挤化还是风格周期，目前无定论。
                </li>
                <li>
                  <strong className="text-slate-100">容量有限。</strong>
                  持仓集中于冷门小盘股，策略规模稍大即撞上涨停与流动性
                  天花板，数字无法随资金量线性外推。
                </li>
                <li>
                  <strong className="text-slate-100">无真正样本外。</strong>
                  机制参数在全历史窗口内选定，尚未经过真实的样本外岁月检验。
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            数据截止 {STRATEGY.meta.asof} · 回测区间{" "}
            {STRATEGY.meta.backtestStart} 至 {STRATEGY.meta.dataEnd} ·
            历史回测，非实盘业绩，不构成投资建议
          </p>
        </div>
      </section>
    </div>
  );
}
