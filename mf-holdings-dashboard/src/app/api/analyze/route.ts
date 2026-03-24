import { NextRequest, NextResponse } from "next/server";
import {
  analyzeWithGroq,
  analyzeMrfFundWithGroq,
  analyzeQdFundWithGroq,
  type AnalyzeInput,
  type MrfFundDataForAI,
} from "@/lib/groq";

export async function POST(req: NextRequest) {
  const qwenKey = process.env.QWEN_API_KEY?.trim();
  if (!qwenKey) {
    return NextResponse.json(
      {
        signal: "hold",
        confidence: 50,
        thesis:
          "未配置 Qwen API。请在 .env.local 中设置 QWEN_API_KEY（阿里云 DashScope，兼容 OpenAI 格式）。可选 QWEN_MODEL=qwen-plus|qwen-turbo|qwen-max。",
        keyRisks: [],
        catalysts: [],
      },
      { status: 200 }
    );
  }
  try {
    const body = (await req.json()) as AnalyzeInput & {
      analysisType?: string;
      fundData?: MrfFundDataForAI;
    };

    if (body.analysisType === "mrf_fund" && body.fundData?.fund_name) {
      const fd = body.fundData;
      const result = await analyzeMrfFundWithGroq(
        {
          fund_name: String(fd.fund_name),
          brand: String(fd.brand ?? ""),
          equity_pct: Number(fd.equity_pct ?? 0),
          fixed_income_pct: Number(fd.fixed_income_pct ?? 0),
          cash_pct: Number(fd.cash_pct ?? 0),
          fee_rate: Number(fd.fee_rate ?? 0),
          holdings: Array.isArray(fd.holdings)
            ? fd.holdings.map((h) => ({
                name: String((h as { name?: string }).name ?? ""),
                weight_pct: Number((h as { weight_pct?: number }).weight_pct ?? 0),
                holding_type: (h as { holding_type?: string }).holding_type,
              }))
            : [],
        },
        qwenKey
      );
      return NextResponse.json(result);
    }

    if (body.analysisType === "qd_fund" && (body as any).fundData?.primary_code) {
      const fd = (body as any).fundData as {
        primary_code: string;
        fund_name_cn: string;
        holdings?: { name: string; weight_pct: number; holding_type?: string }[];
      };
      const result = await analyzeQdFundWithGroq(
        {
          primary_code: String(fd.primary_code),
          fund_name_cn: String(fd.fund_name_cn ?? ""),
          holdings: Array.isArray(fd.holdings)
            ? fd.holdings.map((h) => ({
                name: String((h as any).name ?? ""),
                weight_pct: Number((h as any).weight_pct ?? 0),
                holding_type: (h as any).holding_type,
              }))
            : [],
        },
        qwenKey
      );
      return NextResponse.json(result);
    }

    if (body.analysisType === "portfolio") {
      // 组合分析：直接把 context 透传给模型（analyzeWithGroq 会按中文 schema 输出）
      const result = await analyzeWithGroq(body as AnalyzeInput, qwenKey);
      return NextResponse.json(result as any);
    }

    const input = body as AnalyzeInput;
    const result = await analyzeWithGroq(input, qwenKey);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
