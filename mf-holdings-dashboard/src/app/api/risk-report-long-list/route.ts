import { NextResponse } from "next/server";
import { listLongReportsSorted } from "@/lib/riskLongReports";

export const dynamic = "force-dynamic";

/** 供 /risk 页下拉：文件名时间戳优先，新→旧 */
export async function GET() {
  try {
    const reports = listLongReportsSorted();
    return NextResponse.json(
      {
        reports: reports.map((r) => ({
          name: r.name,
          mtimeMs: r.mtimeMs,
          label: r.label,
          fileTimeMs: r.fileTimeMs,
          mtimeZh: new Date(r.mtimeMs).toLocaleString("zh-CN", {
            hour12: false,
          }),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch {
    return NextResponse.json({ reports: [] });
  }
}
