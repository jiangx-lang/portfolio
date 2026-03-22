import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const reportPath =
    "/root/fredmonitor/outputs/crisis_monitor/crisis_report_latest.html";
  try {
    const content = fs.readFileSync(reportPath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse(
      '<h1 style="color:white;background:#0a0f1e;padding:40px">报告暂未生成</h1>',
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
