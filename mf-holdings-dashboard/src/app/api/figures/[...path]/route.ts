import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 与 crisis 报告 HTML 中 figures/ 相对路径在 /api/ 下解析出的 URL 一致 */
const FIGURES_DIR =
  process.env.CRISIS_FIGURES_DIR ||
  "/root/fredmonitor/outputs/crisis_monitor/figures";

const SEGMENT_SAFE = /^[a-zA-Z0-9._-]+$/;

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * GET /api/figures/warsh_liquidity.png
 * 当 iframe 文档为 /api/risk-report-html 时，未改写的 src="figures/..." 会解析到此路径。
 */
export async function GET(
  _req: NextRequest,
  context: { params: { path: string[] } }
) {
  const segments = context.params.path ?? [];
  if (segments.length === 0) {
    return new NextResponse(null, { status: 404 });
  }
  if (!segments.every((s) => SEGMENT_SAFE.test(s))) {
    return new NextResponse(null, { status: 400 });
  }

  const baseResolved = path.resolve(FIGURES_DIR);
  const fullPath = path.resolve(path.join(FIGURES_DIR, ...segments));
  if (!fullPath.startsWith(baseResolved + path.sep) && fullPath !== baseResolved) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const buf = fs.readFileSync(fullPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType(fullPath),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
