import { createQwenOpenAIClient, getQwenModel } from "@/lib/qwenOpenai";

export type MarketDataRow = {
  ticker?: string;
  weight?: number;
  market?: string;
  data_source?: string;
  pe_ttm?: number | null;
  pb?: number | null;
  implied_volatility?: number | null;
  put_call_ratio?: number | null;
  beta?: number | null;
  data_quality?: string;
  error?: string;
};

function weightedAvg(
  rows: MarketDataRow[],
  pick: (r: MarketDataRow) => number | null | undefined,
  wkey: (r: MarketDataRow) => number
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
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

export async function runFundDeepAnalysisGroq(
  fundName: string,
  marketData: MarketDataRow[],
  apiKey: string
): Promise<Record<string, unknown>> {
  const rows = Array.isArray(marketData) ? marketData : [];
  const valid = rows.filter((d) => !d.error);

  const wpe = weightedAvg(valid, (r) => r.pe_ttm ?? null, (r) => r.weight ?? 0);
  const wpb = weightedAvg(valid, (r) => r.pb ?? null, (r) => r.weight ?? 0);
  const wiv = weightedAvg(valid, (r) => r.implied_volatility ?? null, (r) => r.weight ?? 0);

  const pcrRows = valid.filter((d) => d.put_call_ratio != null);
  const avgPCR =
    pcrRows.length > 0
      ? pcrRows.reduce((s, d) => s + (d.put_call_ratio as number), 0) / pcrRows.length
      : null;

  const lines = rows.map((d) => {
    const w = ((d.weight ?? 0) * 100).toFixed(1);
    const ivs =
      d.implied_volatility != null ? `${(d.implied_volatility * 100).toFixed(1)}%` : "insufficient data (non-US or no chain)";
    const pcr = d.put_call_ratio != null ? String(d.put_call_ratio) : "—";
    const qual = d.data_quality || "—";
    const mkt = d.market ?? "—";
    const src = d.data_source ?? "—";
    return `- ${d.ticker} (${w}%): PE=${d.pe_ttm?.toFixed?.(1) ?? "N/A"}, PB=${d.pb?.toFixed?.(2) ?? "N/A"}, IV=${ivs}, PCR=${pcr}, market=${mkt}, source=${src}, coverage=${qual}`;
  });

  const coverageStr = `${valid.length}/${rows.length} holdings`;

  const wpeStr = wpe != null ? wpe.toFixed(1) : "N/A";
  const wpbStr = wpb != null ? wpb.toFixed(2) : "N/A";
  const wivPctStr = wiv != null ? (wiv * 100).toFixed(1) : "N/A";
  const avgPcrStr = avgPCR != null ? avgPCR.toFixed(2) : "N/A";

  const prompt = `你是跨资产分析师，仅根据下列公开持仓市场数据做客观归纳（非个性化投顾）。

基金：${String(fundName || "Fund")}

每行 source 来自 scripts/fetch_market_data.py（如 akshare_hk+yfinance、naver_kr+yfinance、yfinance）。

【服务端已算好的加权指标】（你可在 JSON 中复述，最终以服务端合并为准）：
- 加权 PE（TTM）：${wpeStr}
- 加权 PB：${wpbStr}
- 加权 IV（有期权则按权重加权，值为百分比数字，如 32.5 表示 32.5%）：${wivPctStr}
- 平均 Put/Call Ratio（各成分算术平均，含 Beta 代理）：${avgPcrStr}

【各成分持仓】
${lines.join("\n")}

【数据覆盖】${coverageStr}（无 error 的条数 / 总条数）

规则：
- 港股/非美股常无期权 IV，属数据不足而非失败。
- 高估值 + 高 IV 可能反映拥挤；低估值 + 高 IV 可能反映压力或机会——客观描述。
- 不得给出针对个人的买卖指令；investment_action 仅为粗标签（buy/hold/avoid）。

请用中文撰写 key_driver 与 top_warning（各一句，专业、克制）。

Return ONLY valid JSON（不要 markdown）：
{
  "valuation_level": "overvalued|fair|undervalued",
  "market_sentiment": "fear|neutral|optimistic",
  "risk_signal": "low|medium|high",
  "weighted_pe": number | null,
  "weighted_pb": number | null,
  "weighted_iv_pct": number | null,
  "avg_pcr": number | null,
  "key_driver": "一句中文，说明核心驱动",
  "top_warning": "一句中文说明主要风险，若无则 null",
  "investment_action": "buy|hold|avoid",
  "confidence": "low|medium|high",
  "data_coverage": "${coverageStr}"
}

字段 data_coverage 必须严格为：${coverageStr}`;

  const client = createQwenOpenAIClient(apiKey);
  const completion = await client.chat.completions.create({
    model: getQwenModel(),
    messages: [
      {
        role: "system",
        content:
          "只输出一个 JSON 对象，不要 markdown。你不是投资顾问；表述为数据观察。key_driver、top_warning 必须用中文。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 700,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "invalid_json_from_llm", raw: String(text).slice(0, 400) };
  }

  const weightedIvPct = wiv != null ? Math.round(wiv * 1000) / 10 : null;

  return {
    ...parsed,
    weighted_pe: wpe != null ? Math.round(wpe * 10) / 10 : (parsed.weighted_pe as number | null) ?? null,
    weighted_pb: wpb != null ? Math.round(wpb * 100) / 100 : (parsed.weighted_pb as number | null) ?? null,
    weighted_iv_pct:
      weightedIvPct != null ? weightedIvPct : (parsed.weighted_iv_pct as number | null) ?? null,
    avg_pcr: avgPCR != null ? Math.round(avgPCR * 100) / 100 : (parsed.avg_pcr as number | null) ?? null,
    data_coverage: coverageStr,
  };
}
