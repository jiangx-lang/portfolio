/**
 * 认证服务端工具：Supabase service 客户端、登录令牌、口令哈希、登录日志。
 * 仅服务端 API 路由使用（依赖 SUPABASE_SERVICE_ROLE_KEY / AUTH_SECRET）。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

let _serviceClient: SupabaseClient | null = null;

/**
 * Service Role Supabase 客户端（注册/登录共用）。
 * 缺少环境变量时返回 null，由调用方决定如何降级。
 */
export function getServiceSupabase(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  if (!_serviceClient) {
    _serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _serviceClient;
}

/** atlas_auth cookie 令牌：`username.expMs.hmac_base64url`，30 天有效 */
export function createAuthToken(username: string): string {
  // 与 middleware / progress-server 保持同一兜底，避免本地开发未配 AUTH_SECRET 时登录 500
  const secret = process.env.AUTH_SECRET || "atlas-progress-dev-secret";

  const expMs = Date.now() + THIRTY_DAYS_SEC * 1000;
  const payload = `${username}.${expMs}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/** scrypt 口令哈希，格式 `scrypt:<salt_hex>:<hash_hex>` */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/** 校验口令；stored 非 `scrypt:salt:hash` 格式时直接 false */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = Buffer.from(parts[2], "hex");
  if (!salt || expected.length !== 64) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, expected);
}

function getIpFromHeaders(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** 写 login_logs 登录日志；任何失败都静默，不影响登录/注册 */
export async function logLogin(req: Request, username: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return;
    await supabase.from("login_logs").insert({
      username,
      ip: getIpFromHeaders(req),
      user_agent: req.headers.get("user-agent") || "unknown",
    });
  } catch {
    // ignore
  }
}
