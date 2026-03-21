import { NextRequest, NextResponse } from "next/server";
import { fetchQuote } from "@/lib/yahoo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const q = await fetchQuote(ticker.toUpperCase());
    return NextResponse.json(q);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
