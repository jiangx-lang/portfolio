import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getSyncMeta } from "@/lib/chronicle/load";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CHRONICLE_SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-chronicle-sync-secret") || "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return header === secret || bearer === secret;
}

/** GET：同步状态 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    meta: getSyncMeta(),
    hint: "POST with x-chronicle-sync-secret to trigger npm run sync:chronicle",
  });
}

/**
 * POST：触发全量同步（需 CHRONICLE_SYNC_SECRET）
 * 与 History of Market 同源 JSON；建议由 cron 调用，勿公开。
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dash = process.cwd();
  const script = path.join(dash, "scripts", "sync-historyofmarket.mjs");

  const result = await new Promise<{ code: number | null; log: string }>((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: dash,
      env: process.env,
      windowsHide: true,
    });
    let log = "";
    child.stdout.on("data", (d) => {
      log += d.toString();
    });
    child.stderr.on("data", (d) => {
      log += d.toString();
    });
    child.on("close", (code) => resolve({ code, log: log.slice(-8000) }));
  });

  return NextResponse.json({
    ok: result.code === 0,
    code: result.code,
    meta: getSyncMeta(),
    log: result.log,
  });
}
