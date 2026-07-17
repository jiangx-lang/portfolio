import { NextRequest, NextResponse } from "next/server";
import { recordUserEvent, serializeProgressCookie } from "@/lib/progress-server";
import { XP_REWARDS, type EventType, getProgressToNext } from "@/lib/progress";

const VALID_EVENT_TYPES = Object.keys(XP_REWARDS) as EventType[];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const eventType = body.eventType as EventType;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "未知事件类型" }, { status: 400 });
  }

  const meta = {
    page_path: typeof body.page_path === "string" ? body.page_path : undefined,
    content_type: typeof body.content_type === "string" ? body.content_type : undefined,
  };

  try {
    const result = await recordUserEvent(req.cookies, eventType, meta);
    const { currentLevel, nextLevel, progressPct, xpToNext } = getProgressToNext(result.xp);

    const response = NextResponse.json({
      username: result.username,
      xp: result.xp,
      level: result.level,
      xpDelta: result.xpDelta,
      levelName: currentLevel.name,
      nextLevelName: nextLevel?.name || null,
      progressPct,
      xpToNext,
    });

    response.cookies.set(serializeProgressCookie(result.cookieToken));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "记录失败";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
