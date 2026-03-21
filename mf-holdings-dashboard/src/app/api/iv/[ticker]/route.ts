import { NextRequest, NextResponse } from "next/server";
import { fetchIVStats } from "@/lib/yahoo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const stats = await fetchIVStats(ticker.toUpperCase());
    return NextResponse.json(stats);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch IV stats" },
      { status: 500 }
    );
  }
}
