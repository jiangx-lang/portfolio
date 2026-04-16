import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const COOKIE_NAME = "atlas_auth";
const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

// 以后要换密码或“踢掉某个支行”，只改这里重新部署即可
const USERS: Record<string, string> = {
  cdzf: "cdzf",
  cdzmq: "cdzmq",
  fsqdh: "fsqdh",
  rebecca: "rebecca",
  admin: "cd123",
};

function createToken(username: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET");

  const expMs = Date.now() + THIRTY_DAYS_SEC * 1000;
  const payload = `${username}.${expMs}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function getIpFromHeaders(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  const expected = USERS[username.toLowerCase()];
  if (!expected || expected !== password) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "服务未配置 Supabase 环境变量" },
      { status: 500 }
    );
  }

  const token = createToken(username);

  // 记录登录日志到 Supabase（失败不影响登录）
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabase.from("login_logs").insert({
      username,
      ip: getIpFromHeaders(req),
      user_agent: req.headers.get("user-agent") || "unknown",
    });
  } catch {
    // ignore
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS_SEC,
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

