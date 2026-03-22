import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "atlas2024";

type WmpJsonPayload = {
  success?: boolean;
  message?: string;
  written?: number;
  scraped?: number;
  skipped?: boolean;
};

function parseWmpJsonLine(output: string): WmpJsonPayload | null {
  const lines = output.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    const idx = line.indexOf("__WMP_JSON__");
    if (idx >= 0) {
      try {
        return JSON.parse(line.slice(idx + "__WMP_JSON__".length).trim()) as WmpJsonPayload;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const pwd =
    typeof body === "object" &&
    body !== null &&
    "pwd" in body &&
    typeof (body as { pwd: unknown }).pwd === "string"
      ? (body as { pwd: string }).pwd
      : "";
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, message: "未授权" },
      { status: 401 }
    );
  }

  const scriptPath =
    process.env.WMP_SCRAPER_SCRIPT?.trim() ||
    path.join(process.cwd(), "scripts", "scrape_wmp.py");
  const pythonBin = process.env.WMP_SCRAPER_PYTHON?.trim() || "python3";

  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json(
      {
        success: false,
        message: `未找到脚本: ${scriptPath}（可设置环境变量 WMP_SCRAPER_SCRIPT）`,
      },
      { status: 500 }
    );
  }

  const r = spawnSync(pythonBin, [scriptPath], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env },
    windowsHide: true,
  });

  const combined = [r.stdout ?? "", r.stderr ?? ""].join("\n");
  const parsed = parseWmpJsonLine(combined);

  if (parsed && typeof parsed.message === "string") {
    const ok = parsed.success !== false;
    return NextResponse.json(
      {
        success: ok,
        message: parsed.message,
        written: parsed.written ?? 0,
        scraped: parsed.scraped ?? 0,
        skipped: Boolean(parsed.skipped),
      },
      { status: ok ? 200 : 500 }
    );
  }

  if (r.error) {
    return NextResponse.json(
      {
        success: false,
        message: `无法启动 ${pythonBin}: ${r.error.message}`,
      },
      { status: 500 }
    );
  }

  if (r.signal) {
    return NextResponse.json(
      {
        success: false,
        message: `进程被信号终止: ${r.signal}`,
      },
      { status: 500 }
    );
  }

  const tail = combined.trim().slice(-2000) || `exit code ${r.status ?? "?"}`;
  return NextResponse.json(
    {
      success: r.status === 0,
      message: tail,
    },
    { status: r.status === 0 ? 200 : 500 }
  );
}
