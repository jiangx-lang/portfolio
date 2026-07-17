"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { getProgressToNext } from "@/lib/progress";

interface ProgressData {
  username: string;
  xp: number;
  level: number;
  levelName: string;
}

export function UserProgressBadge({ compact = false }: { compact?: boolean }) {
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

  if (loading) {
    return <div className="h-8 w-24 skeleton rounded-full" />;
  }

  if (!progress) return null;

  const { currentLevel, nextLevel, progressPct, xpToNext } = getProgressToNext(progress.xp);

  const progressHint =
    xpToNext > 0 && nextLevel
      ? `距 ${nextLevel.name} 还需 ${xpToNext} XP`
      : "已达最高等级";

  if (compact) {
    return (
      <div
        title={progressHint}
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.12] px-2.5 py-1"
      >
        <Crown className="h-3 w-3 text-gold" strokeWidth={2} />
        <span className="font-mono text-[11px] font-semibold text-gold-light">
          Lv{progress.level}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      title={progressHint}
      className="flex items-center gap-2.5 rounded-full border border-gold/30 bg-gold/[0.1] py-1.5 pr-3.5 pl-1.5 transition-shadow duration-300 hover:shadow-glow-gold"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
        <Crown className="h-3 w-3 text-[#1A1405]" strokeWidth={2.2} />
      </span>
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="font-mono text-xs font-semibold text-gold-light">
          Lv{progress.level}
        </span>
        <span className="text-xs text-slate-300">{currentLevel.name}</span>
      </span>
      <span className="h-[3px] w-14 overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className="block h-full rounded-full bg-gradient-gold"
          style={{ width: `${progressPct}%` }}
        />
      </span>
    </motion.div>
  );
}
