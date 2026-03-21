import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const MAX_POINTS = 252;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ isin: string }> }
) {
  const { isin } = await params;
  const ccy = _req.nextUrl.searchParams.get("ccy") || "USD";

  if (!isin?.trim()) {
    return NextResponse.json(
      { error: "Missing isin" },
      { status: 400 }
    );
  }

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { dates: [], navs: [], isin: isin.trim() },
        { status: 200 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { dates: [], navs: [], isin: isin.trim() },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("nav_history")
      .select("nav_date, nav")
      .eq("isin", isin.trim())
      .eq("ccy", ccy)
      .order("nav_date", { ascending: false })
      .limit(MAX_POINTS);

    if (error) {
      console.error("nav_history error:", error);
      return NextResponse.json(
        { dates: [], navs: [], isin: isin.trim() },
        { status: 200 }
      );
    }

    const rows = (data ?? []).reverse();
    const dates = rows.map((r) => String(r.nav_date).slice(0, 10));
    const navs = rows.map((r) => Number(r.nav));

    return NextResponse.json({ dates, navs, isin: isin.trim() });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch nav history" },
      { status: 500 }
    );
  }
}
