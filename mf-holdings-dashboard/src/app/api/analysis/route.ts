import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type UpsertBody = {
  fund_code: string;
  fund_type: "MRF" | "QD";
  fund_name: string;
  signal?: string;
  confidence?: number;
  summary?: string;
  thesis?: string;
  strengths?: unknown;
  risks?: unknown;
  fee_assessment?: string;
  suitable_investor?: string;
  allocation_comment?: string;
  recommendation?: string;
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await req.json()) as Partial<UpsertBody>;
  const fund_code = String(body.fund_code || "").trim();
  const fund_type = (String(body.fund_type || "").toUpperCase() as "MRF" | "QD") || "MRF";
  const fund_name = String(body.fund_name || "").trim();
  if (!fund_code || !fund_name || (fund_type !== "MRF" && fund_type !== "QD")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = {
    fund_code,
    fund_type,
    fund_name,
    signal: body.signal ?? "hold",
    confidence: Number.isFinite(Number(body.confidence)) ? Number(body.confidence) : 50,
    summary: body.summary ?? "",
    thesis: body.thesis ?? "",
    strengths: Array.isArray(body.strengths) ? body.strengths : body.strengths ?? [],
    risks: Array.isArray(body.risks) ? body.risks : body.risks ?? [],
    fee_assessment: body.fee_assessment ?? "",
    suitable_investor: body.suitable_investor ?? "",
    allocation_comment: body.allocation_comment ?? "",
    recommendation: body.recommendation ?? "",
    generated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("fund_ai_analysis")
    .upsert(payload, { onConflict: "fund_code,fund_type" })
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

