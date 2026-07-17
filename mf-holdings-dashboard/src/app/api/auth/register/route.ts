import { NextResponse } from "next/server";
import {
  createAuthToken,
  getServiceSupabase,
  hashPassword,
  logLogin,
} from "@/lib/auth-server";
import {
  ensureUserProgressByUsername,
  recordUserEventByUsername,
  serializeProgressCookie,
} from "@/lib/progress-server";

const COOKIE_NAME = "atlas_auth";
const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// 硬编码共享账号（与 login 路由一致，注册用户名不得与之冲突）
const USERS: Record<string, string> = {
  cdzf: "cdzf",
  cdzmq: "cdzmq",
  fsqdh: "fsqdh",
  rebecca: "rebecca",
  admin: "cd123",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username || "")
    .trim()
    .toLowerCase();
  const password = String(body?.password || "");

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "用户名需为 3-20 位字母、数字或下划线" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  // 与硬编码共享账号冲突
  if (USERS[username]) {
    return NextResponse.json({ error: "该用户名已被注册" }, { status: 409 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "注册服务暂未开放，请联系管理员" },
      { status: 503 }
    );
  }

  // 查重：app_users 已存在同名用户
  const { data: existing, error: selectError } = await supabase
    .from("app_users")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  if (selectError) {
    // 表不存在（42P01）等：注册服务未就绪，不暴露细节
    return NextResponse.json(
      { error: "注册服务暂未开放，请联系管理员" },
      { status: 503 }
    );
  }
  if (existing) {
    return NextResponse.json({ error: "该用户名已被注册" }, { status: 409 });
  }

  const { error: insertError } = await supabase.from("app_users").insert({
    username,
    password_hash: hashPassword(password),
  });

  if (insertError) {
    // 唯一约束冲突（并发注册同名校验之间的窗口）
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "该用户名已被注册" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "注册服务暂未开放，请联系管理员" },
      { status: 503 }
    );
  }

  // 注册成功 = 自动登录：后续流程与 login 路由完全一致
  let token: string;
  try {
    token = createAuthToken(username);
  } catch {
    return NextResponse.json(
      { error: "服务未配置 AUTH_SECRET" },
      { status: 500 }
    );
  }

  // 记录登录日志到 Supabase（失败不影响注册）
  await logLogin(req, username);

  // 初始化/更新用户使用进度（注册即送每日 XP）
  let progressCookie = null;
  try {
    await ensureUserProgressByUsername(username);
    const progress = await recordUserEventByUsername(username, "login_daily");
    progressCookie = serializeProgressCookie(progress.cookieToken);
  } catch {
    // 进度系统失败不影响注册
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS_SEC,
    path: "/",
    sameSite: "lax",
  });

  if (progressCookie) {
    response.cookies.set(progressCookie);
  }

  return response;
}
