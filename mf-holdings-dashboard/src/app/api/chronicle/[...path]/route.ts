import { NextRequest, NextResponse } from "next/server";
import { loadChronicleJson } from "@/lib/chronicle/load";

export const dynamic = "force-dynamic";

/**
 * GET /api/chronicle/sp500/pe.json
 * 优先读 public/chronicle-data，缺失则回源 historyofmarket.com
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: { path?: string[] } }
) {
  const parts = ctx.params.path || [];
  if (!parts.length) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  const rel = parts.join("/");
  try {
    const data = await loadChronicleJson(rel);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "X-Chronicle-Attribution":
          "History of Market - historyofmarket.com (CC-BY-4.0)",
        "X-Chronicle-Source": "atlas-mirror-or-live",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
