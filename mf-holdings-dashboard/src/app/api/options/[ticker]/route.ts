import { NextRequest, NextResponse } from "next/server";
import { getOptionsChain } from "@/lib/publiccom";
import { getQuote } from "@/lib/publiccom";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const expiry =
    _req.nextUrl.searchParams.get("expiry") || "2025-06-20";
  try {
    const quote = await getQuote(ticker.toUpperCase());
    const chain = await getOptionsChain(ticker.toUpperCase(), expiry, quote.price);
    return NextResponse.json(chain);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch options chain" },
      { status: 500 }
    );
  }
}
