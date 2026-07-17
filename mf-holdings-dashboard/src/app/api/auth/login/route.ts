import { NextResponse } from "next/server";
import {
  createAuthToken,
  getServiceSupabase,
  logLogin,
  verifyPassword,
} from "@/lib/auth-server";
import {
  ensureUserProgressByUsername,
  recordUserEventByUsername,
  serializeProgressCookie,
  PROGRESS_COOKIE,
} from "@/lib/progress-server";

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  let username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  const expected = USERS[username.toLowerCase()];
  if (expected) {
    // 硬编码共享账号：明文比对（旧行为保留）
    if (expected !== password) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
  } else {
    // 自助注册账号：查 app_users 表做 scrypt 校验
    const supabase = getServiceSupabase();
    let valid = false;
    if (supabase) {
      const { data, error } = await supabase
        .from("app_users")
        .select("password_hash")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      valid =
        !error &&
        !!data &&
        verifyPassword(password, String(data.password_hash || ""));
    }
    if (!valid) {
      // 查表失败（表不存在等）同样按凭据错误处理，不暴露细节
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
    // 注册账号统一用小写规范化用户名签发令牌 / 统计 XP
    username = username.toLowerCase();
  }

  if (!getServiceSupabase()) {
    return NextResponse.json(
      { error: "服务未配置 Supabase 环境变量" },
      { status: 500 }
    );
  }

  const token = createAuthToken(username);

  // 记录登录日志到 Supabase（失败不影响登录）
  await logLogin(req, username);

  // 初始化/更新用户使用进度（登录即送每日 XP）
  let progressCookie = null;
  try {
    await ensureUserProgressByUsername(username);
    const progress = await recordUserEventByUsername(username, "login_daily");
    progressCookie = serializeProgressCookie(progress.cookieToken);
  } catch {
    // 进度系统失败不影响登录
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

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  response.cookies.delete(PROGRESS_COOKIE);
  return response;
}
