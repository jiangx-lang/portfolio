import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const reportPath =
    "/root/fredmonitor/outputs/crisis_monitor/crisis_report_latest.md";
  try {
    const content = fs.readFileSync(reportPath, "utf-8");
    return NextResponse.json({ content, updated: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "报告暂未生成" }, { status: 404 });
  }
}
