import { NextRequest, NextResponse } from "next/server";
import { ensureUserProgress, serializeProgressCookie } from "@/lib/progress-server";
import { getProgressToNext } from "@/lib/progress";

export async function GET(req: NextRequest) {
  const progress = await ensureUserProgress(req.cookies);
  if (!progress) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { currentLevel, nextLevel, progressPct, xpToNext } = getProgressToNext(progress.xp);

  const response = NextResponse.json({
    username: progress.username,
    xp: progress.xp,
    level: progress.level,
    levelName: currentLevel.name,
    nextLevelName: nextLevel?.name || null,
    progressPct,
    xpToNext,
  });

  // 同步 cookie（防止首次登录后 cookie 缺失）
  const payload = {
    username: progress.username,
    xp: progress.xp,
    level: progress.level,
    updatedAt: Date.now(),
  };
  const { signProgress } = await import("@/lib/progress-crypto");
  const token = await signProgress(payload, process.env.AUTH_SECRET || "atlas-progress-dev-secret");
  response.cookies.set(serializeProgressCookie(token));

  return response;
}
