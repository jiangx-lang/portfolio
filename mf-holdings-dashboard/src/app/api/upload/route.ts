import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "cd123";

const COOKIE_NAME = "atlas_auth";

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function sanitizeFilename(original: string) {
  const name = String(original || "").trim();
  // 保留“原始文件名”的语义，但避免路径穿越/分隔符注入
  const replaced = name
    .replace(/[\\\/]+/g, "_")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .trim();
  return replaced || "upload.bin";
}

function verifySignedCookieToken(token: string | undefined | null) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!username || !Number.isFinite(exp) || exp <= Date.now()) return null;
  const payload = `${username}.${expStr}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return null;
  return { username };
}

function isAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1] && m[1].trim() === ADMIN_PASSWORD) return true;

  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  const parsed = verifySignedCookieToken(cookieToken);
  if (parsed?.username?.toLowerCase() === "admin") return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("请使用 multipart/form-data 上传");

  const bucket = String(form.get("bucket") || "").trim();
  const file = form.get("file");
  if (!bucket) return badRequest("缺少 bucket");
  if (!(file instanceof File)) return badRequest("缺少 file");

  const filename = sanitizeFilename(file.name);

  const plan =
    bucket === "podcasts"
      ? {
          dir: "/root/data/market_files/podcasts",
          publicBase: "https://media.atlasallocations.com/podcasts",
        }
      : bucket === "reports"
        ? {
            dir: "/root/data/market_files/pdfs",
            publicBase: "https://media.atlasallocations.com/pdfs",
          }
        : null;

  if (!plan) return badRequest("bucket 只允许 podcasts / reports");

  await mkdir(plan.dir, { recursive: true });

  const abs = path.join(plan.dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf, { flag: "wx" });

  return NextResponse.json({ url: `${plan.publicBase}/${encodeURIComponent(filename)}` });
}

