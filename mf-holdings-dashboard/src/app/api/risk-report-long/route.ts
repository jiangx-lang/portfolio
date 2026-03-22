import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  mimeForExt,
  readLongReportBytes,
} from "@/lib/riskLongReports";

export const dynamic = "force-dynamic";

/**
 * GET /api/risk-report-long          → 默认返回 mtime 最新的长图
 * GET /api/risk-report-long?name=xxx → 返回指定文件名（须为 crisis_report_long* 且合法后缀）
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  const result = readLongReportBytes(name);
  if (!result) {
    return new NextResponse(null, { status: 404 });
  }
  const ext = path.extname(result.chosen);
  return new NextResponse(new Uint8Array(result.buf), {
    status: 200,
    headers: {
      "Content-Type": mimeForExt(ext),
      "Cache-Control": "no-store, max-age=0",
      "X-Risk-Long-Source": result.chosen,
    },
  });
}
