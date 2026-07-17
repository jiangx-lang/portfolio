/**
 * 服务端进度读写。
 * 优先写入 Supabase（user_progress / user_activity），未配置时回退到签名 cookie。
 */

import { getSupabaseServiceRole } from "@/lib/supabase";
import {
  signProgress,
  verifyProgress,
  parseUsernameFromAuthToken,
  type ProgressCookie,
} from "@/lib/progress-crypto";
import {
  getLevel,
  XP_REWARDS,
  type EventType,
} from "@/lib/progress";

const AUTH_COOKIE = "atlas_auth";
export const PROGRESS_COOKIE = "atlas_progress";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface CookieReader {
  get(name: string): { value?: string } | undefined;
}

export interface UserProgress {
  username: string;
  xp: number;
  level: number;
}

function getSecret(): string {
  return process.env.AUTH_SECRET || "atlas-progress-dev-secret";
}

export async function getUserProgress(
  cookies: CookieReader
): Promise<UserProgress | null> {
  const authToken = cookies.get(AUTH_COOKIE)?.value;
  const username = parseUsernameFromAuthToken(authToken);
  if (!username) return null;

  const supabase = getSupabaseServiceRole();
  if (supabase) {
    const { data, error } = await supabase
      .from("user_progress")
      .select("xp")
      .eq("username", username)
      .maybeSingle();
    if (!error && data && typeof data.xp === "number") {
      return { username, xp: data.xp, level: getLevel(data.xp).level };
    }
  }

  const progressToken = cookies.get(PROGRESS_COOKIE)?.value;
  if (progressToken) {
    const verified = await verifyProgress(progressToken, getSecret());
    if (verified && verified.username === username) {
      return {
        username,
        xp: verified.xp,
        level: getLevel(verified.xp).level,
      };
    }
  }

  return { username, xp: 0, level: 1 };
}

export async function ensureUserProgress(
  cookies: CookieReader
): Promise<UserProgress | null> {
  const authToken = cookies.get(AUTH_COOKIE)?.value;
  const username = parseUsernameFromAuthToken(authToken);
  if (!username) return null;
  return ensureUserProgressByUsername(username);
}

export async function ensureUserProgressByUsername(
  username: string
): Promise<UserProgress> {
  const supabase = getSupabaseServiceRole();
  if (supabase) {
    const { data } = await supabase
      .from("user_progress")
      .select("xp")
      .eq("username", username)
      .maybeSingle();
    if (!data) {
      await supabase.from("user_progress").insert({
        username,
        xp: 0,
        level: 1,
      });
      return { username, xp: 0, level: 1 };
    }
    const xp = typeof data.xp === "number" ? data.xp : 0;
    return { username, xp, level: getLevel(xp).level };
  }
  return { username, xp: 0, level: 1 };
}

export async function recordUserEvent(
  cookies: CookieReader,
  eventType: EventType,
  meta?: { page_path?: string; content_type?: string }
): Promise<UserProgress & { cookieToken: string; xpDelta: number }> {
  const current = await getUserProgress(cookies);
  if (!current) {
    throw new Error("未登录");
  }
  return recordUserEventByUsername(current.username, eventType, meta);
}

export async function recordUserEventByUsername(
  username: string,
  eventType: EventType,
  meta?: { page_path?: string; content_type?: string }
): Promise<UserProgress & { cookieToken: string; xpDelta: number }> {
  let xpDelta = XP_REWARDS[eventType];
  let currentXp = 0;

  const supabase = getSupabaseServiceRole();
  if (supabase) {
    // 每日登录只奖励一次
    if (eventType === "login_daily") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentLogin } = await supabase
        .from("user_activity")
        .select("id")
        .eq("username", username)
        .eq("event_type", "login_daily")
        .gte("created_at", oneDayAgo)
        .limit(1)
        .maybeSingle();
      if (recentLogin) xpDelta = 0;
    }

    await supabase.from("user_activity").insert({
      username,
      event_type: eventType,
      xp_delta: xpDelta,
      page_path: meta?.page_path?.slice(0, 512) || null,
      content_type: meta?.content_type?.slice(0, 64) || null,
    });

    await supabase.rpc("increment_user_xp", {
      p_username: username,
      p_delta: xpDelta,
    });

    const { data: row } = await supabase
      .from("user_progress")
      .select("xp")
      .eq("username", username)
      .maybeSingle();
    currentXp = row?.xp ?? xpDelta;
  } else {
    currentXp = xpDelta;
  }

  const level = getLevel(currentXp).level;

  const payload: ProgressCookie = {
    username,
    xp: currentXp,
    level,
    updatedAt: Date.now(),
  };
  const cookieToken = await signProgress(payload, getSecret());

  return { username, xp: currentXp, level, cookieToken, xpDelta };
}

export function serializeProgressCookie(token: string) {
  return {
    name: PROGRESS_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
