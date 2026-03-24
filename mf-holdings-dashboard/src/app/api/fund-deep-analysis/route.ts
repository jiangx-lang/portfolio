import { NextResponse } from "next/server";
/** 持仓深度分析 / 基金摘要：中文 prompt、avg_pcr 与加权指标合并见 `runFundDeepAnalysisGroq`（底层为 Qwen） */
import { runFundDeepAnalysisGroq } from "@/lib/fundDeepAnalysisGroq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const key = process.env.QWEN_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "missing_QWEN_API_KEY" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { fundName, marketData } = body ?? {};
    // 限制 marketData 规模，降低模型接口被刷与超大 payload 风险
    if (!Array.isArray(marketData) || marketData.length === 0 || marketData.length > 20) {
      return NextResponse.json(
        { error: "invalid_request", detail: "marketData must be a non-empty array with at most 20 items" },
        { status: 400 }
      );
    }
    const result = await runFundDeepAnalysisGroq(String(fundName || "Fund"), marketData, key);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "analysis_failed", detail: msg }, { status: 500 });
  }
}
