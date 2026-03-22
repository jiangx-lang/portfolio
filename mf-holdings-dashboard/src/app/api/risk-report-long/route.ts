import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRISIS_DIR =
  process.env.CRISIS_MONITOR_OUT_DIR ||
  "/root/fredmonitor/outputs/crisis_monitor";

const LONG_PREFIX = /^crisis_report_long/i;

function mimeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

/**
 * 返回目录下最新的 crisis_report_long*.{png,jpg,jpeg,webp}（按 mtime）。
 * 与 fred_crisis_monitor 生成的长图文件名一致。
 */
export async function GET() {
  try {
    const names = fs.readdirSync(CRISIS_DIR);
    const candidates = names.filter((n) => {
      if (!LONG_PREFIX.test(n)) return false;
      const ext = path.extname(n);
      return [".png", ".jpg", ".jpeg", ".webp"].includes(ext.toLowerCase());
    });
    if (candidates.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    const sorted = candidates.sort((a, b) => {
      const ta = fs.statSync(path.join(CRISIS_DIR, a)).mtimeMs;
      const tb = fs.statSync(path.join(CRISIS_DIR, b)).mtimeMs;
      return tb - ta;
    });
    const chosen = sorted[0];
    const full = path.join(CRISIS_DIR, chosen);
    const buf = fs.readFileSync(full);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeFor(path.extname(chosen)),
        "Cache-Control": "public, max-age=60",
        "X-Risk-Long-Source": chosen,
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
