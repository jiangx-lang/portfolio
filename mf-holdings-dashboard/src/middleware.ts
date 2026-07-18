import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FEATURES } from "@/lib/progress";
import { verifyProgress } from "@/lib/progress-crypto";

const PROGRESS_COOKIE = "atlas_progress";
const AUTH_COOKIE = "atlas_auth";

function getRequiredLevelForPath(pathname: string): { level: number; feature: string | null } {
  if (pathname === "/") return { level: 1, feature: null };

  // 匹配带参数的静态前缀
  for (const f of FEATURES) {
    if (!f.route) continue;
    if (pathname === f.route || pathname.startsWith(`${f.route}/`)) {
      return { level: f.requiredLevel, feature: f.key };
    }
  }

  return { level: 1, feature: null };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行登录、API、静态资源
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/progress") ||
    pathname.startsWith("/api/chronicle") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 基于使用进度的能力解锁
  const { level: requiredLevel, feature } = getRequiredLevelForPath(pathname);
  const progressToken = request.cookies.get(PROGRESS_COOKIE)?.value;
  let userLevel = 1;

  if (progressToken) {
    const verified = await verifyProgress(
      progressToken,
      process.env.AUTH_SECRET || "atlas-progress-dev-secret"
    );
    if (verified && verified.level >= 1) {
      userLevel = verified.level;
    }
  }

  if (userLevel < requiredLevel) {
    const unlockUrl = new URL("/unlock", request.url);
    if (feature) unlockUrl.searchParams.set("feature", feature);
    unlockUrl.searchParams.set("required", String(requiredLevel));
    unlockUrl.searchParams.set("current", String(userLevel));
    return NextResponse.redirect(unlockUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
