import { createQwenOpenAIClient } from "@/lib/qwenOpenai";

/** 持仓深度分析专用模型：默认 qwen-turbo，可通过 QWEN_REPORT_MODEL 覆盖 */
function getReportModel(): string {
  const m = process.env.QWEN_REPORT_MODEL?.trim();
  return m && m.length > 0 ? m : "qwen-turbo";
}

export type MarketDataRow = {
  ticker?: string;
  name?: string;
  weight?: number;
  market?: string;
  data_source?: string;
  pe_ttm?: number | null;
  pb?: number | null;
  beta?: number | null;
  dividend_yield?: number | null;
  implied_volatility?: number | null;
  put_call_ratio?: number | null;
  data_quality?: string;
  error?: string;
  cached?: boolean;
};

export interface ScoreResult {
  overall: number;
  valuation: number;
  sentiment: number;
  risk: number;
  quality: number;
  valuationLabel: string;
  sentimentLabel: string;
  riskLabel: string;
  qualityLabel: string;
}

export type RiskFlagType = "danger" | "warning" | "info" | "success" | "neutral";

export interface RiskFlag {
  label: string;
  type: RiskFlagType;
}

export interface AiInsights {
  valuationConclusion: string;
  sentimentSignal: string;
  advisorRecommendation: string;
  keyRisks: string;
  marketContext: string;
}

export interface DeepAnalysisResult {
  scores: ScoreResult;
  weightedMetrics: {
    pe: number | null;
    pb: number | null;
    ivPct: number | null;
    pcr: number | null;
    dividendYield: number | null;
    beta: number | null;
  };
  concentration: {
    top4Weight: number;
    top10Weight: number;
    hhi: number;
    effectiveN: number;
  };
  riskFlags: RiskFlag[];
  aiInsights: AiInsights | null;
  holdingsDetail: MarketDataRow[];
  llmError?: string;
}

function weightedAvg(
  rows: MarketDataRow[],
  pick: (r: MarketDataRow) => number | null | undefined,
  wkey: (r: MarketDataRow) => number
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    if (r.error) continue;
    const v = pick(r);
    if (v == null || Number.isNaN(v)) continue;
    const w = wkey(r);
    if (w <= 0) continue;
    num += v * w;
    den += w;
  }
  if (den <= 0) return null;
  return num / den;
}

function scoreBandLabel(score: number, labels: [string, string, string, string]): string {
  if (score >= 75) return labels[0];
  if (score >= 60) return labels[1];
  if (score >= 45) return labels[2];
  return labels[3];
}

function calcFourDimensionScore(marketData: MarketDataRow[], weightedMetrics: DeepAnalysisResult["weightedMetrics"]): ScoreResult {
  const valid = marketData.filter((d) => !d.error && (d.weight ?? 0) > 0);
  const wpe = weightedMetrics.pe;
  const wpb = weightedMetrics.pb;

  let peScore = 50;
  if (wpe != null && !Number.isNaN(wpe)) {
    if (wpe < 10) peScore = 90;
    else if (wpe < 15) peScore = 75;
    else if (wpe < 20) peScore = 60;
    else if (wpe < 30) peScore = 45;
    else peScore = 25;
  }

  let pbScore = 50;
  if (wpb != null && !Number.isNaN(wpb)) {
    if (wpb < 1) pbScore = 90;
    else if (wpb < 2) pbScore = 75;
    else if (wpb < 3) pbScore = 60;
    else if (wpb < 5) pbScore = 40;
    else pbScore = 20;
  }

  const valuationScore =
    wpe != null && wpb != null ? Math.round(peScore * 0.6 + pbScore * 0.4) : wpe != null ? peScore : wpb != null ? pbScore : 50;

  const wpcr = weightedMetrics.pcr;
  let pcrScore = 55;
  if (wpcr != null && !Number.isNaN(wpcr)) {
    if (wpcr < 0.7) pcrScore = 85;
    else if (wpcr < 0.9) pcrScore = 70;
    else if (wpcr < 1.1) pcrScore = 55;
    else if (wpcr < 1.3) pcrScore = 40;
    else pcrScore = 20;
  }

  const wivPct = weightedMetrics.ivPct;
  let ivScore = 55;
  if (wivPct != null && !Number.isNaN(wivPct)) {
    if (wivPct < 15) ivScore = 85;
    else if (wivPct < 20) ivScore = 70;
    else if (wivPct < 30) ivScore = 55;
    else if (wivPct < 40) ivScore = 35;
    else ivScore = 20;
  }

  const sentimentScore = Math.round(pcrScore * 0.5 + ivScore * 0.5);

  const wbeta = weightedMetrics.beta;
  let betaScore = 60;
  if (wbeta != null && !Number.isNaN(wbeta)) {
    if (wbeta < 0.7) betaScore = 85;
    else if (wbeta < 0.9) betaScore = 75;
    else if (wbeta < 1.1) betaScore = 60;
    else if (wbeta < 1.3) betaScore = 45;
    else betaScore = 25;
  }

  const { hhi } = computeConcentrationRaw(valid);
  let hhiScore = 55;
  if (hhi < 500) hhiScore = 85;
  else if (hhi < 800) hhiScore = 70;
  else if (hhi < 1200) hhiScore = 55;
  else if (hhi < 1500) hhiScore = 40;
  else hhiScore = 25;

  const riskScore = Math.round(betaScore * 0.6 + hhiScore * 0.4);

  const wdiv = weightedMetrics.dividendYield;
  let divScore = 40;
  if (wdiv != null && !Number.isNaN(wdiv) && wdiv > 0) {
    if (wdiv > 4) divScore = 85;
    else if (wdiv > 2) divScore = 75;
    else if (wdiv > 1) divScore = 60;
    else divScore = 50;
  }

  const n = marketData.length;
  const withPePb = marketData.filter((d) => !d.error && d.pe_ttm != null && d.pb != null).length;
  const coverageRate = n > 0 ? withPePb / n : 0;
  const coverageScore = Math.round(coverageRate * 100);
  const qualityScore = Math.round(divScore * 0.6 + coverageScore * 0.4);

  const overall = Math.round(
    valuationScore * 0.3 + sentimentScore * 0.25 + riskScore * 0.25 + qualityScore * 0.2
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    valuation: Math.min(100, Math.max(0, valuationScore)),
    sentiment: Math.min(100, Math.max(0, sentimentScore)),
    risk: Math.min(100, Math.max(0, riskScore)),
    quality: Math.min(100, Math.max(0, qualityScore)),
    valuationLabel: scoreBandLabel(valuationScore, ["低估", "合理", "中性偏贵", "高估"]),
    sentimentLabel: scoreBandLabel(sentimentScore, ["看多", "中性", "偏空", "看空"]),
    riskLabel: scoreBandLabel(riskScore, ["低风险", "中低风险", "中等风险", "高风险"]),
    qualityLabel: scoreBandLabel(qualityScore, ["高质量", "良好", "一般", "偏弱"]),
  };
}

/** HHI：权重归一化后 Σ(100w)²，与历史风险阈值一致 */
function computeConcentrationRaw(rows: MarketDataRow[]): { hhi: number; top4Weight: number; top10Weight: number; effectiveN: number } {
  const valid = rows.filter((r) => !r.error && (r.weight ?? 0) > 0).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const w = valid.map((r) => r.weight ?? 0);
  const sumW = w.reduce((a, b) => a + b, 0);
  const norm = sumW > 0 ? w.map((x) => x / sumW) : w;
  const top4Weight = norm.slice(0, 4).reduce((a, b) => a + b, 0);
  const top10Weight = norm.slice(0, 10).reduce((a, b) => a + b, 0);
  const hhi = norm.reduce((s, x) => s + Math.pow(x * 100, 2), 0);
  const sumSq = norm.reduce((s, x) => s + x * x, 0);
  const effectiveN = sumSq > 1e-9 ? 1 / sumSq : 0;
  return { hhi, top4Weight, top10Weight, effectiveN };
}

function buildWeightedMetrics(rows: MarketDataRow[]): DeepAnalysisResult["weightedMetrics"] {
  const valid = rows.filter((d) => !d.error);
  const wpe = weightedAvg(valid, (r) => r.pe_ttm ?? null, (r) => r.weight ?? 0);
  const wpb = weightedAvg(valid, (r) => r.pb ?? null, (r) => r.weight ?? 0);
  const wiv = weightedAvg(valid, (r) => r.implied_volatility ?? null, (r) => r.weight ?? 0);
  const pcrRows = valid.filter((d) => d.put_call_ratio != null);
  const wpcr =
    pcrRows.length > 0
      ? pcrRows.reduce((s, d) => s + (d.put_call_ratio as number) * (d.weight ?? 0), 0) /
        pcrRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;
  const divRows = valid.filter((d) => d.dividend_yield != null && (d.dividend_yield ?? 0) > 0);
  const wdiv =
    divRows.length > 0
      ? divRows.reduce((s, d) => s + (d.dividend_yield as number) * (d.weight ?? 0), 0) /
        divRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;
  const betaRows = valid.filter((d) => d.beta != null);
  const wbeta =
    betaRows.length > 0
      ? betaRows.reduce((s, d) => s + (d.beta as number) * (d.weight ?? 0), 0) /
        betaRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;

  return {
    pe: wpe != null ? Math.round(wpe * 10) / 10 : null,
    pb: wpb != null ? Math.round(wpb * 100) / 100 : null,
    ivPct: wiv != null ? Math.round(wiv * 1000) / 10 : null,
    pcr: wpcr != null ? Math.round(wpcr * 1000) / 1000 : null,
    dividendYield: wdiv != null ? Math.round(wdiv * 100) / 100 : null,
    beta: wbeta != null ? Math.round(wbeta * 100) / 100 : null,
  };
}

function generateRiskFlags(marketData: MarketDataRow[], _scores: ScoreResult): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const valid = marketData.filter((d) => !d.error && (d.weight ?? 0) > 0);
  const { top4Weight, hhi } = computeConcentrationRaw(valid);

  const pcrRows = valid.filter((d) => d.put_call_ratio != null);
  const wPCR =
    pcrRows.length > 0
      ? pcrRows.reduce((s, d) => s + (d.put_call_ratio as number) * (d.weight ?? 0), 0) /
        pcrRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;

  const ivRows = valid.filter((d) => d.implied_volatility != null);
  const wIVPct =
    ivRows.length > 0
      ? (ivRows.reduce((s, d) => s + (d.implied_volatility as number) * (d.weight ?? 0), 0) /
          ivRows.reduce((s, d) => s + (d.weight ?? 0), 0)) *
        100
      : null;

  const divRows = valid.filter((d) => d.dividend_yield != null && (d.dividend_yield ?? 0) > 0);
  const wDiv =
    divRows.length > 0
      ? divRows.reduce((s, d) => s + (d.dividend_yield as number) * (d.weight ?? 0), 0) /
        divRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;

  const betaRows = valid.filter((d) => d.beta != null);
  const wBeta =
    betaRows.length > 0
      ? betaRows.reduce((s, d) => s + (d.beta as number) * (d.weight ?? 0), 0) /
        betaRows.reduce((s, d) => s + (d.weight ?? 0), 0)
      : null;

  if (wPCR != null) {
    if (wPCR > 1.2) flags.push({ label: `PCR ${wPCR.toFixed(2)} 偏空信号`, type: "danger" });
    else if (wPCR < 0.8) flags.push({ label: `PCR ${wPCR.toFixed(2)} 偏多信号`, type: "success" });
  }

  if (wIVPct != null) {
    if (wIVPct > 35) flags.push({ label: `IV ${wIVPct.toFixed(0)}% 波动极高`, type: "danger" });
    else if (wIVPct > 25) flags.push({ label: `IV ${wIVPct.toFixed(0)}% 波动偏高`, type: "warning" });
  }

  if (top4Weight > 0.4) flags.push({ label: `前四持仓合计 ${(top4Weight * 100).toFixed(0)}%`, type: "warning" });

  if (wDiv != null && wDiv > 3) flags.push({ label: `加权股息率约 ${wDiv.toFixed(1)}%`, type: "success" });

  if (wBeta != null) {
    if (wBeta < 0.85) flags.push({ label: `Beta ${wBeta.toFixed(2)} 偏低波`, type: "success" });
    else if (wBeta > 1.3) flags.push({ label: `Beta ${wBeta.toFixed(2)} 高波`, type: "warning" });
  }

  if (hhi > 1500) flags.push({ label: "持仓高度集中（HHI）", type: "danger" });

  return flags;
}

function buildCompactPrompt(
  fundName: string,
  marketData: MarketDataRow[],
  scores: ScoreResult,
  wm: DeepAnalysisResult["weightedMetrics"]
): string {
  const valid = marketData.filter((d) => !d.error && (d.weight ?? 0) > 0);
  const wPE = wm.pe != null ? wm.pe.toFixed(1) : "N/A";
  const wPB = wm.pb != null ? wm.pb.toFixed(2) : "N/A";
  const wPCR = wm.pcr != null ? wm.pcr.toFixed(2) : "N/A";
  const wIV = wm.ivPct != null ? wm.ivPct.toFixed(1) : "N/A";
  const wDiv = wm.dividendYield != null ? wm.dividendYield.toFixed(2) : "N/A";
  const wBeta = wm.beta != null ? wm.beta.toFixed(2) : "N/A";

  const top5 = [...valid]
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 5)
    .map((d) => {
      const pe = d.pe_ttm != null ? Number(d.pe_ttm).toFixed(1) : "N/A";
      const pb = d.pb != null ? Number(d.pb).toFixed(2) : "N/A";
      const pcr = d.put_call_ratio != null ? Number(d.put_call_ratio).toFixed(2) : "N/A";
      const div =
        d.dividend_yield != null
          ? (Number(d.dividend_yield) * 100).toFixed(1) + "%"
          : "N/A";
      return `${d.name ?? d.ticker ?? "?"}(${(Number(d.weight) * 100).toFixed(1)}% | PE ${pe}x | PB ${pb}x | PCR ${pcr} | 股息 ${div})`;
    })
    .join("\n");

  return `你是一名资深机构买方研究员，风格参照高盛/摩根士丹利投研报告。请根据下方量化数据，撰写专业的持仓深度解读。

## 基金信息
基金名称：${fundName}
持仓数量：${valid.length} 只

## 量化评分（满分100）
综合评分：${scores.overall}分
- 估值维度：${scores.valuation}分（${scores.valuationLabel}）
- 情绪维度：${scores.sentiment}分（${scores.sentimentLabel}）
- 风险维度：${scores.risk}分（${scores.riskLabel}）
- 质量维度：${scores.quality}分（${scores.qualityLabel}）

## 加权组合指标
PE（TTM）：${wPE}x | PB：${wPB}x | Beta：${wBeta}
隐含波动率：${wIV}% | 认沽/认购比率（PCR）：${wPCR}
加权股息率：${wDiv}%

## 前五大持仓
${top5 || "数据不足"}

## 输出要求
返回一个合法 JSON 对象，字段如下。每个字段写作风格须符合机构投研标准：
- 使用具体数字和指标支撑判断，避免模糊表述
- 语言简练、专业，不使用\"非常\"\"很\"等口语化形容词
- 估值结论须引用 PE/PB 具体数值与行业参考区间
- 情绪信号须结合 PCR 和 IV 数值给出方向性判断
- 风险提示须量化（如\"Beta 1.35 高于基准 35%\"），不得泛泛而谈
- 末尾须注明数据局限性，不构成投资建议

{
  \"valuationConclusion\": \"基于PE/PB等估值指标的专业分析，须引用具体数值，约60-80字\",
  \"sentimentSignal\": \"基于PCR和IV的市场情绪判断，须说明方向和强度，约50-70字\",
  \"advisorRecommendation\": \"针对不同风险偏好投资者的观察要点（非买卖指令），约60-80字\",
  \"keyRisks\": \"三条核心风险，每条须量化，格式：风险名称：具体描述（含数值）；用分号分隔\",
  \"marketContext\": \"当前宏观环境与流动性对该组合的潜在影响，约40-60字，须结合Beta和IV数据\"
}

只返回 JSON，不要任何 markdown 或额外文字。`;
}

async function fetchAiInsights(
  fundName: string,
  marketData: MarketDataRow[],
  scores: ScoreResult,
  wm: DeepAnalysisResult["weightedMetrics"],
  apiKey: string
): Promise<{ insights: AiInsights | null; error?: string }> {
  try {
    const client = createQwenOpenAIClient(apiKey);
    const completion = await client.chat.completions.create({
      model: getReportModel(),
      messages: [
        {
          role: "system",
          content: "只输出合法 JSON 对象，键名与用户要求一致。你不是投资顾问，勿给出具体买卖指令。",
        },
        { role: "user", content: buildCompactPrompt(fundName, marketData, scores, wm) },
      ],
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { insights: null, error: "invalid_json_from_llm" };
    }
    return {
      insights: {
        valuationConclusion: String(raw.valuationConclusion ?? ""),
        sentimentSignal: String(raw.sentimentSignal ?? ""),
        advisorRecommendation: String(raw.advisorRecommendation ?? ""),
        keyRisks: String(raw.keyRisks ?? ""),
        marketContext: String(raw.marketContext ?? ""),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { insights: null, error: msg };
  }
}

export async function runFundDeepAnalysisGroq(
  fundName: string,
  marketData: MarketDataRow[],
  apiKey?: string | null
): Promise<DeepAnalysisResult> {
  const rows = Array.isArray(marketData) ? (marketData as MarketDataRow[]) : [];
  const wm = buildWeightedMetrics(rows);
  const scores = calcFourDimensionScore(rows, wm);
  const conc = computeConcentrationRaw(rows.filter((d) => !d.error && (d.weight ?? 0) > 0));
  const riskFlags = generateRiskFlags(rows, scores);

  let aiInsights: AiInsights | null = null;
  let llmError: string | undefined;
  const key = apiKey?.trim();
  if (key) {
    const { insights, error } = await fetchAiInsights(fundName, rows, scores, wm, key);
    aiInsights = insights;
    if (error) llmError = error;
  }

  return {
    scores,
    weightedMetrics: wm,
    concentration: {
      top4Weight: conc.top4Weight,
      top10Weight: conc.top10Weight,
      hhi: Math.round(conc.hhi * 10) / 10,
      effectiveN: Math.round(conc.effectiveN * 100) / 100,
    },
    riskFlags,
    aiInsights,
    holdingsDetail: rows,
    llmError,
  };
}
