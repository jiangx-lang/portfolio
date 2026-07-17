"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, BookOpen, Star, Crown } from "lucide-react";
import { getProgressToNext } from "@/lib/progress";

interface ProgressData {
  xp: number;
  level: number;
  levelName: string;
  nextLevelName: string | null;
}

const quickActions = [
  { label: "浏览页面", xp: 5, icon: TrendingUp },
  { label: "AI 摘要", xp: 20, icon: Sparkles },
  { label: "阅读笔记", xp: 10, icon: BookOpen },
  { label: "添加自选", xp: 10, icon: Star },
];

export function UpgradeBanner() {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    fetch("/api/progress/me")
      .then((r) => r.json())
      .then((data) => setProgress(data as ProgressData))
      .catch(() => {});
  }, []);

  const { nextLevel, progressPct, xpToNext } = progress
    ? getProgressToNext(progress.xp)
    : getProgressToNext(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass-card p-5 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-gold/[0.1] border border-gold/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-gold" />
          </span>
          <span className="font-display text-base font-bold text-white">
            使用越多，解锁越多
          </span>
        </div>
        {progress && (
          <span className="badge badge-gold">
            <Crown className="w-3 h-3" />
            Lv.{progress.level} {progress.levelName}
          </span>
        )}
      </div>

      {progress && (
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-gold transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {nextLevel ? (
              <>
                距离 <span className="text-gold-light">{nextLevel.name}</span>{" "}
                还需 <span className="num text-gold-light">{xpToNext}</span> XP
              </>
            ) : (
              "已达成最高等级，全部能力开放"
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <span
            key={action.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-slate-300"
          >
            <action.icon className="w-3.5 h-3.5 text-gold" />
            {action.label}
            <span className="num text-gold-light">+{action.xp} XP</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}
