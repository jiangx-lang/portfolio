/**
 * 基金/股票 AI 分析：经阿里云 Qwen OpenAI 兼容接口调用（原 Groq 已弃用）。
 * Same response schema as Claude so upgrade = swap client + model.
 */

import { createQwenOpenAIClient, getQwenModel } from "@/lib/qwenOpenai";
import type { AISignal } from "@/types";

const SYSTEM_PROMPT = `你是公开市场信息与波动数据的分析师（非投顾）。
用简洁中文输出事实性数据摘要与风险说明；禁止给出买入、卖出、加仓、减仓、跟投等任何操作指引。
文末须在 JSON 某字段中体现「不构成任何投资建议」之意（可写入 valuationComment 或单独一句）。
只返回 JSON，不要 markdown。`;

export interface AnalyzeInput {
  ticker: string;
  context?: unknown;
  analysisType:
    | "stock"
    | "options"
    | "portfolio"
    | "risk"
    | "scenario"
    | "mrf_fund"
    | "qd_fund";
}

export async function analyzeWithGroq(
  input: AnalyzeInput,
  apiKey: string
): Promise<AISignal> {
  const client = createQwenOpenAIClient(apiKey);
  const model = getQwenModel();

  const ctxObj =
    typeof input.context === "string"
      ? (() => {
          try {
            return JSON.parse(input.context);
          } catch {
            return null;
          }
        })()
      : (input.context as any);

  // portfolio 专用：避免输出期权术语
  if (input.analysisType === "portfolio") {
    const holdings = ctxObj?.holdings ?? [];
    const prompt = `
请用中文对以下公开持仓组合做数据向摘要（禁止任何买卖或仓位操作建议）。

持仓：${JSON.stringify(holdings)}

只返回 JSON：
{
  "overallSignal": "buy" | "hold" | "trim",
  "portfolioComment": "3句：行业与集中度等客观描述，末句须含「不构成投资建议」",
  "topPicks": [{"ticker":"代码","reason":"权重或业务一句客观描述"}],
  "mainRisk": "主要风险维度（1句，客观）",
  "optionsPerspective": "波动与定价环境一句客观描述（避免衍生品术语堆砌）",
  "recommendation": "数据观察要点（2句，禁止操作建议）"
}
`;
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text) as any;
  }

  const price = ctxObj?.price;
  const ivRank = Number(ctxObj?.ivRank);
  const iv30d = ctxObj?.iv30d;
  const nextEarnings = ctxObj?.nextEarnings;

  const ivComment =
    Number.isFinite(ivRank) && ivRank < 30
      ? `隐含波动分位偏低，市场对短期波动定价相对温和（仅数据描述）。`
      : Number.isFinite(ivRank) && ivRank < 50
        ? `隐含波动分位居中，定价分歧一般（仅数据描述）。`
        : Number.isFinite(ivRank)
          ? `隐含波动分位偏高，短期不确定性定价较高（仅数据描述）。`
          : `衍生品侧波动数据暂缺，以下仅基于公开价量与基本面维度做信息摘要。`;

  const prompt = `
请对标的 ${input.ticker} 输出公开市场数据类中文摘要（禁止是否值得投资、禁止买入卖出时机、禁止跟投表述）。

基本数据：
- 最新参考价：$${price || "未知"}
- 波动分位示意：${Number.isFinite(ivRank) ? ivRank : "未知"}/100
  说明：${ivComment}
- 30日隐含波动率：${iv30d || "未知"}%
- 下次财报披露窗口：${nextEarnings || "未知"}

只返回JSON（signal 仅作内部标签，UI 会映射为中性用语；文案中禁止操作建议）：
{
  "signal": "strong_buy" | "buy" | "hold" | "trim" | "sell",
  "confidence": 75,
  "headline": "15字内数据要点摘要（禁止买卖表述）",
  "whyInvest": "2-3句业务与行业客观描述（禁止号召投资）",
  "marketSentiment": "1句波动/情绪数据说明（不要写 IV Rank 字样）",
  "timingScore": 75,
  "timingExplanation": "1句仅描述当前波动环境，禁止「现在该不该买」",
  "keyRisks": ["风险1", "风险2"],
  "priceTarget": {
    "bull": 220,
    "base": 195,
    "bear": 155,
    "explanation": "情景价区间仅为假设演算，非预测或目标价承诺"
  },
  "simpleStrategy": {
    "forConservative": "波动与流动性客观说明（禁止个性化建议）",
    "forGrowth": "行业Beta等客观说明（禁止个性化建议）",
    "optionSignal": "衍生品定价环境一句话（不要术语堆砌）"
  },
  "valuationVerdict": "attractive" | "fair" | "expensive",
  "valuationComment": "估值一句客观描述；末句须含「不构成任何投资建议」"
}
`;
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });
  const text = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text) as AISignal;
  } catch {
    return {
      signal: "hold",
      confidence: 50,
      thesis: text || "Analysis unavailable.",
      keyRisks: [],
      catalysts: [],
    };
  }
}

/** MRF 互认基金 — 传给模型的持仓摘要 */
export interface MrfFundDataForAI {
  fund_name: string;
  brand: string;
  equity_pct: number;
  fixed_income_pct: number;
  cash_pct: number;
  fee_rate: number;
  holdings?: { name: string; weight_pct: number; holding_type?: string }[];
}

export type MrfAnalyzeResult = {
  signal: string;
  confidence: number;
  summary: string;
  thesis: string;
  strengths: string[];
  risks: string[];
  fee_assessment: string;
  suitable_investor: string;
  allocation_comment: string;
  recommendation: string;
};

const MRF_SYSTEM_PROMPT = `你是基金公开披露信息的整理与摘要助手（非投顾）。
用中文只返回 JSON。描述资产配置、费率、持仓结构、风险维度；禁止申购赎回建议、禁止适合哪类投资者跟投等表述。
recommendation 字段仅写「数据观察要点」，末句须含不构成任何投资建议。`;

export async function analyzeMrfFundWithGroq(
  fundData: MrfFundDataForAI,
  apiKey: string
): Promise<MrfAnalyzeResult> {
  const client = createQwenOpenAIClient(apiKey);
  const model = getQwenModel();
  const riskType =
    fundData.equity_pct >= 80 ? "进取型" : fundData.equity_pct >= 40 ? "均衡型" : "稳健型";
  const topHoldings = (fundData.holdings ?? []).slice(0, 5);
  const userPrompt = `根据公开信息摘要这只 MRF 基金（禁止任何申购赎回或跟投建议）：
基金名称：${fundData.fund_name}
品牌：${fundData.brand}
资产配置：股票${fundData.equity_pct}% / 固定收益${fundData.fixed_income_pct}% / 现金${fundData.cash_pct}%
申购费率：${fundData.fee_rate}%
风险类型（标签）：${riskType}
Top Holdings：${JSON.stringify(topHoldings)}

请返回以下 JSON 结构：
{
  "signal": "strong_buy" | "buy" | "hold" | "trim" | "sell",
  "confidence": 0-100,
  "summary": "一句话客观摘要",
  "thesis": "2-3句基金策略与持仓客观描述",
  "strengths": ["特点1", "特点2", "特点3"],
  "risks": ["风险1", "风险2"],
  "fee_assessment": "费率水平客观描述",
  "suitable_investor": "风险等级客观标签（禁止写「适合您」或号召购买）",
  "allocation_comment": "资产配置客观点评",
  "recommendation": "数据观察要点，末句：不构成任何投资建议"
}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: MRF_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  try {
    const raw = JSON.parse(text) as Partial<MrfAnalyzeResult>;
    return {
      signal: String(raw.signal ?? "hold"),
      confidence: Math.min(100, Math.max(0, Number(raw.confidence ?? 50))),
      summary: String(raw.summary ?? ""),
      thesis: String(raw.thesis ?? ""),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
      risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
      fee_assessment: String(raw.fee_assessment ?? ""),
      suitable_investor: String(raw.suitable_investor ?? ""),
      allocation_comment: String(raw.allocation_comment ?? ""),
      recommendation: String(raw.recommendation ?? ""),
    };
  } catch {
    return {
      signal: "hold",
      confidence: 50,
      summary: "解析失败，请重试",
      thesis: text.slice(0, 500),
      strengths: [],
      risks: [],
      fee_assessment: "",
      suitable_investor: "",
      allocation_comment: "",
      recommendation: "",
    };
  }
}

export interface QdFundDataForAI {
  primary_code: string;
  fund_name_cn: string;
  holdings?: { name: string; weight_pct: number; holding_type?: string }[];
}

const QD_SYSTEM_PROMPT = `你是 QDII 基金公开披露信息的摘要助手（非投顾）。只返回 JSON。
客观描述持仓、集中度、地区行业暴露、风险维度；禁止买卖建议与跟投表述。`;

export async function analyzeQdFundWithGroq(
  fundData: QdFundDataForAI,
  apiKey: string
): Promise<MrfAnalyzeResult> {
  const client = createQwenOpenAIClient(apiKey);
  const model = getQwenModel();
  const topHoldings = (fundData.holdings ?? []).slice(0, 5);
  const userPrompt = `根据公开信息摘要这只 QDII 基金（禁止申购赎回或跟投建议）：
基金名称：${fundData.fund_name_cn}
产品代码：${fundData.primary_code}
Top Holdings：${JSON.stringify(topHoldings)}

请返回以下 JSON 结构：
{
  "signal": "strong_buy" | "buy" | "hold" | "trim" | "sell",
  "confidence": 0-100,
  "summary": "一句话客观摘要",
  "thesis": "2-3句策略与持仓客观描述",
  "strengths": ["特点1", "特点2", "特点3"],
  "risks": ["风险1", "风险2"],
  "fee_assessment": "费率或写暂无费率数据",
  "suitable_investor": "风险标签客观描述（禁止号召购买）",
  "allocation_comment": "持仓/配置客观点评",
  "recommendation": "数据观察要点，末句：不构成任何投资建议"
}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: QD_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  try {
    const raw = JSON.parse(text) as Partial<MrfAnalyzeResult>;
    return {
      signal: String(raw.signal ?? "hold"),
      confidence: Math.min(100, Math.max(0, Number(raw.confidence ?? 50))),
      summary: String(raw.summary ?? ""),
      thesis: String(raw.thesis ?? ""),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
      risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
      fee_assessment: String(raw.fee_assessment ?? "暂无费率数据"),
      suitable_investor: String(raw.suitable_investor ?? ""),
      allocation_comment: String(raw.allocation_comment ?? ""),
      recommendation: String(raw.recommendation ?? ""),
    };
  } catch {
    return {
      signal: "hold",
      confidence: 50,
      summary: "解析失败，请重试",
      thesis: text.slice(0, 500),
      strengths: [],
      risks: [],
      fee_assessment: "暂无费率数据",
      suitable_investor: "",
      allocation_comment: "",
      recommendation: "",
    };
  }
}
