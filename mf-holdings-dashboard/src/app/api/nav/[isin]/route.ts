import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** days=0（全部）时上限 */
const MAX_POINTS_ALL = 5000;
/** 有日期下限时：按日历跨度给足点数（日频净值约 ≤ days；留余量） */
function limitForDays(days: number): number {
  if (days <= 0) return MAX_POINTS_ALL;
  return Math.min(MAX_POINTS_ALL, Math.max(252, Math.ceil(days * 1.2)));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ isin: string }> }
) {
  const { isin } = await params;
  const ccy = _req.nextUrl.searchParams.get("ccy") || "USD";

  const daysRaw = _req.nextUrl.searchParams.get("days");
  let days = daysRaw !== null && daysRaw !== "" ? parseInt(daysRaw, 10) : 365;
  if (!Number.isFinite(days) || days < 0) days = 365;
  /** 防止恶意超大窗口；5Y=1825 为产品上限 */
  if (days > 0) days = Math.min(days, 1825);

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

    // days=0：不限制起始日期（全部历史，仍受 MAX_POINTS_ALL 限制）
    // days>0：nav_date >= 今天往前推 days 天（UTC 日历日）
    let startStr: string | null = null;
    if (days > 0) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);
      startStr = start.toISOString().slice(0, 10);
    }

    const limit = limitForDays(days);

    let q = supabase
      .from("nav_history")
      .select("nav_date, nav")
      .eq("isin", isin.trim())
      .eq("ccy", ccy);

    if (startStr) {
      q = q.gte("nav_date", startStr);
    }

    const { data, error } = await q.order("nav_date", { ascending: false }).limit(limit);

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
