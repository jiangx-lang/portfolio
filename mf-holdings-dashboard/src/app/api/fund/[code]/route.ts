import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** 根据基金 code 查 isin、ccy（用于 QDII 净值页） */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = (await params).code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(null, { status: 404 });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json(null, { status: 404 });

  const { data, error } = await supabase
    .from("fund_list")
    .select("code, isin, ccy")
    .eq("code", code)
    .limit(1)
    .maybeSingle();

  if (error || !data?.isin) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json({
    code: data.code,
    isin: data.isin,
    ccy: data.ccy ?? "USD",
  });
}
