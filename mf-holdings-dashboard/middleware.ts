import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "atlas_auth";

function base64UrlEncode(bytes: ArrayBuffer) {
  const uint8 = new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < uint8.length; i++) str += String.fromCharCode(uint8[i]!);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Base64Url(message: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64UrlEncode(sig);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过登录页和 API 静态资源等
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const [username, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!username || !Number.isFinite(exp) || exp <= Date.now()) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const expectedSig = await hmacSha256Base64Url(`${username}.${expStr}`, secret);
  if (!safeEqual(sig, expectedSig)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

