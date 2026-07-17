/**
 * 进度 cookie 的轻量签名（HMAC-SHA256）。
 * 使用全局 crypto.subtle，兼容 Next.js API 路由（Node）和 Middleware（Edge）。
 */

const ALGO = { name: "HMAC", hash: "SHA-256" };

function stringToBuffer(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(s: string): ArrayBuffer {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", stringToBuffer(secret), ALGO, false, ["sign", "verify"]);
}

export interface ProgressCookie {
  username: string;
  xp: number;
  level: number;
  updatedAt: number;
}

export async function signProgress(payload: ProgressCookie, secret: string): Promise<string> {
  const key = await importKey(secret);
  const body = bufferToBase64url(stringToBuffer(JSON.stringify(payload)));
  const sig = bufferToBase64url(await crypto.subtle.sign(ALGO, key, stringToBuffer(body)));
  return `${body}.${sig}`;
}

export async function verifyProgress(token: string, secret: string): Promise<ProgressCookie | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      ALGO,
      key,
      base64urlToBuffer(sig),
      stringToBuffer(body)
    );
    if (!valid) return null;
    const json = new TextDecoder().decode(base64urlToBuffer(body));
    const parsed = JSON.parse(json) as Partial<ProgressCookie>;
    if (
      typeof parsed.username !== "string" ||
      typeof parsed.xp !== "number" ||
      typeof parsed.level !== "number"
    ) {
      return null;
    }
    return parsed as ProgressCookie;
  } catch {
    return null;
  }
}

/** 从现有 auth token 中解析 username（不验证签名，仅用于识别）。 */
export function parseUsernameFromAuthToken(token?: string): string | null {
  if (!token) return null;
  const firstDot = token.indexOf(".");
  if (firstDot <= 0) return null;
  const payload = token.slice(0, firstDot);
  const [username, expStr] = payload.split(".");
  if (!username) return null;
  const exp = Number(expStr);
  if (!Number.isNaN(exp) && Date.now() > exp) return null;
  return username;
}
