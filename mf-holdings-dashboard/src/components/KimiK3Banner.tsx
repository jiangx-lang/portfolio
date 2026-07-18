import { Sparkles } from "lucide-react";

/**
 * 首页「Kimi K3 美学」品牌横幅：
 * 向访客说明本站视觉与交互均由中国 AI Kimi K3 设计。
 */
const IDIOMS = ["浑然天成", "匠心独运", "神来之笔", "臻于至善"];

export default function KimiK3Banner() {
  return (
    <section className="glass-panel glow-border relative overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-9">
      {/* 顶部金色光晕 */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative">
        <span className="eyebrow inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          AI AESTHETICS BY KIMI K3
        </span>

        <h2 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
          方寸之间，<span className="text-gradient-gold">气象万千</span>
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          本站每一页视觉、每一处交互，皆出自中国 AI「Kimi
          K3」之手——暗夜鎏金，一气呵成。东方智慧与现代美学，于此浑然天成。
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {IDIOMS.map((w) => (
            <span key={w} className="badge badge-gold">
              {w}
            </span>
          ))}
        </div>

        <p className="mt-5 text-xs font-semibold tracking-[0.3em] text-gold/80">
          中国 AI · 不止于智，更臻于美
        </p>
      </div>
    </section>
  );
}
