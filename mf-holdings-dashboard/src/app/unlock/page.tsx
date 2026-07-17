"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Sparkles,
  BookOpen,
  BarChart3,
  Zap,
  PieChart,
  Landmark,
  Globe,
  LineChart,
  Radio,
  Shield,
  Search,
  Activity,
  FileText,
} from "lucide-react";
import {
  getFeatureGate,
  getProgressToNext,
  xpNeededForFeature,
  LEVELS,
  type FeatureKey,
} from "@/lib/progress";

const eventActions = [
  { type: "page_view", label: "浏览一个基金池", icon: BarChart3, xp: 5, href: "/qd" },
  { type: "ai_generate", label: "使用一次 AI 摘要", icon: Sparkles, xp: 20, href: "/qd" },
  { type: "content_read", label: "阅读一篇市场笔记", icon: BookOpen, xp: 10, href: "/notes" },
  { type: "fund_compare", label: "对比两只基金", icon: TrendingUp, xp: 15, href: "/qd" },
  { type: "watchlist_add", label: "添加一只自选", icon: Zap, xp: 10, href: "/qd" },
];

/* progress 体系中的功能图标为 emoji，表现层统一替换为 lucide */
const featureIcons: Record<FeatureKey, typeof Lock> = {
  qd: Landmark,
  mrf: Globe,
  wmp: LineChart,
  notes: BookOpen,
  podcast: Radio,
  portfolio: PieChart,
  stock: BarChart3,
  ai_summary: Sparkles,
  risk: Shield,
  deep_analysis: Search,
  signals: Activity,
  pdf_export: FileText,
};

interface ProgressData {
  username: string;
  xp: number;
  level: number;
  levelName: string;
  nextLevelName: string | null;
  progressPct: number;
  xpToNext: number;
}

function UnlockPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const featureKey = searchParams.get("feature") as FeatureKey | null;

  const feature = featureKey ? getFeatureGate(featureKey) : null;
  const targetXp = feature ? xpNeededForFeature(feature.key) : xpNeededForFeature("portfolio");

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/progress/me")
      .then((r) => r.json())
      .then((data) => {
        setProgress(data as ProgressData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const { progressPct } = progress
    ? getProgressToNext(progress.xp)
    : getProgressToNext(0);

  const xpGap = Math.max(0, targetXp - (progress?.xp || 0));

  /* 所需 / 当前等级：优先取 feature 与进度接口，URL 参数（middleware 写入）兜底 */
  const requiredLevel =
    feature?.requiredLevel ?? (Number(searchParams.get("required")) || 2);
  const currentLevelNum =
    progress?.level ?? (Number(searchParams.get("current")) || 1);
  const requiredLevelName =
    LEVELS.find((l) => l.level === requiredLevel)?.name ?? "";
  const currentLevelName =
    progress?.levelName ??
    (LEVELS.find((l) => l.level === currentLevelNum)?.name || "");

  const FeatureIcon = feature ? featureIcons[feature.key] ?? Lock : Lock;

  return (
    <div className="relative min-h-screen bg-navy text-slate-100 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div
        className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,194,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,194,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]"
        aria-hidden
      />
      <motion.div
        className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-gold/[0.07] blur-[140px]"
        animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" as const }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-12"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="glass-panel glow-border max-w-lg w-full p-8 sm:p-10 text-center"
        >
          {/* 金色 Lock · 圆形柔光底座 */}
          <div className="relative mx-auto mb-7 w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-gold/20 blur-2xl" aria-hidden />
            <div className="relative w-24 h-24 rounded-full bg-gold/[0.08] border border-gold/30 shadow-glow-gold animate-pulse-glow flex items-center justify-center">
              <Lock className="w-9 h-9 text-gold" />
            </div>
          </div>

          <span className="eyebrow justify-center">Membership Tier</span>
          <h1 className="font-display text-3xl font-bold text-gradient-gold mt-3 mb-3">
            {feature ? `「${feature.name}」尚待解锁` : "此功能尚待解锁"}
          </h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            这不是付费功能，而是对你活跃使用的回馈。
            <br />
            再获得{" "}
            <span className="font-mono text-gold font-semibold">{xpGap}</span>{" "}
            <span className="font-mono text-gold">XP</span> 即可解锁。
          </p>

          {/* 当前等级 vs 所需等级 */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5">
              <div className="text-[10px] text-slate-500 tracking-wider uppercase mb-0.5">
                当前等级
              </div>
              <div className="text-sm">
                <span className="font-mono text-gold">Lv.{currentLevelNum}</span>{" "}
                <span className="text-slate-300">{currentLevelName}</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gold/60 shrink-0" />
            <div className="rounded-xl bg-gold/[0.06] border border-gold/25 px-4 py-2.5">
              <div className="text-[10px] text-gold/70 tracking-wider uppercase mb-0.5">
                所需等级
              </div>
              <div className="text-sm">
                <span className="font-mono text-gold-light">Lv.{requiredLevel}</span>{" "}
                <span className="text-slate-200">{requiredLevelName}</span>
              </div>
            </div>
          </div>

          {/* XP 进度 */}
          {loading ? (
            <div className="h-16 skeleton rounded-xl mb-6" />
          ) : progress ? (
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>
                  <span className="font-mono text-gold">Lv.{progress.level}</span>{" "}
                  {progress.levelName}
                </span>
                <span>
                  {progress.nextLevelName
                    ? `下一级：Lv.${progress.level + 1} ${progress.nextLevelName}`
                    : "已满级"}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" as const }}
                  className="h-full rounded-full bg-gradient-gold"
                />
              </div>
              <div className="mt-2 font-mono text-[11px] text-slate-500">
                当前 {progress.xp} XP · 距离下一级还需 {progress.xpToNext} XP
              </div>
            </div>
          ) : null}

          {feature && (
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gold/[0.08] border border-gold/25 flex items-center justify-center shrink-0">
                  <FeatureIcon className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <div className="font-semibold text-white">{feature.name}</div>
                  <div className="text-xs text-slate-500">
                    需要 <span className="font-mono text-gold">Lv.{feature.requiredLevel}</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-400">{feature.description}</div>
            </div>
          )}

          <div className="text-left mb-6">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              快速获取 XP
            </div>
            <div className="space-y-2">
              {eventActions.map((action) => (
                <button
                  key={action.type}
                  onClick={() => router.push(action.href)}
                  className="glass-card w-full flex items-center justify-between p-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <action.icon className="w-4 h-4 text-gold-light" />
                    </div>
                    <span className="text-sm text-slate-200">{action.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-gold font-mono">+{action.xp} XP</span>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-gold transition" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => router.back()} className="btn-ghost w-full">
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </button>
        </motion.div>

        <p className="mt-6 text-xs text-slate-600">
          本平台所有内容仅为市场数据展示与资讯分享，不构成任何投资建议。
        </p>
      </motion.div>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-navy flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-white/10 border-t-gold rounded-full animate-spin" />
        </div>
      }
    >
      <UnlockPageContent />
    </Suspense>
  );
}
