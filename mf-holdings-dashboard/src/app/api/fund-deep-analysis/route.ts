import { NextResponse } from "next/server";
/** 持仓深度分析 / 基金摘要：中文 prompt、avg_pcr 与加权指标合并见 `runFundDeepAnalysisGroq` */
import { runFundDeepAnalysisGroq } from "@/lib/fundDeepAnalysisGroq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "missing_GROQ_API_KEY" }, { status: 500 });
  }

  try {
    const { fundName, marketData } = await req.json();
    const result = await runFundDeepAnalysisGroq(String(fundName || "Fund"), marketData, key);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "analysis_failed", detail: msg }, { status: 500 });
  }
}
