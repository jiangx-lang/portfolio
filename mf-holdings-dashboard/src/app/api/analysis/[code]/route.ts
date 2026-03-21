import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const decoded = decodeURIComponent(code).trim();
  const fundType = new URL(_req.url).searchParams.get("fund_type")?.toUpperCase() || null;

  const supabase = getSupabase();
  if (!supabase || !decoded) return NextResponse.json(null);

  let q = supabase.from("fund_ai_analysis").select("*").eq("fund_code", decoded).limit(1);
  if (fundType === "MRF" || fundType === "QD") {
    q = q.eq("fund_type", fundType);
  }

  const { data } = await q.maybeSingle();
  return NextResponse.json(data || null);
}

