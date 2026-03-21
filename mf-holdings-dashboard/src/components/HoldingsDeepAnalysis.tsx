"use client";



import Link from "next/link";

import { useState, type CSSProperties, type ReactNode } from "react";



export interface HoldingInput {

  ticker?: string;

  name: string;

  weight: number;

  type: string;

}



interface Props {

  fundName: string;

  holdings: HoldingInput[];

}



function Tooltip({ children, tip }: { children: ReactNode; tip: string }) {

  const [show, setShow] = useState(false);

  return (

    <div

      style={{ position: "relative", display: "block", width: "100%" }}

      onMouseEnter={() => setShow(true)}

      onMouseLeave={() => setShow(false)}

    >

      {children}

      {show && (

        <div

          style={{

            position: "absolute",

            bottom: "100%",

            left: "50%",

            transform: "translateX(-50%)",

            marginBottom: 8,

            background: "#0f2744",

            border: "1px solid #3b82f6",

            borderRadius: 8,

            padding: "10px 14px",

            fontSize: 12,

            color: "#cbd5e1",

            lineHeight: 1.6,

            width: "min(280px, 92vw)",

            maxWidth: 320,

            zIndex: 999,

            whiteSpace: "pre-line",

            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",

            pointerEvents: "none",

          }}

        >

          {tip}

          <div

            style={{

              position: "absolute",

              top: "100%",

              left: "50%",

              transform: "translateX(-50%)",

              borderWidth: 6,

              borderStyle: "solid",

              borderColor: "#3b82f6 transparent transparent transparent",

            }}

          />

        </div>

      )}

    </div>

  );

}



const SENTIMENT_COLOR = {

  fear: "#ef4444",

  neutral: "#94a3b8",

  optimistic: "#22c55e",

};



const VALUATION_COLOR = {

  overvalued: "#ef4444",

  fair: "#22c55e",

  undervalued: "#3b82f6",

};



const ACTION_COLOR = {

  avoid: "#ef4444",

  hold: "#f59e0b",

  buy: "#22c55e",

};



const NON_YF_TICKERS = new Set(["BOND", "ETF", "COMMODITY", "FUND", "UNKNOWN"]);



const cardShell: CSSProperties = {

  background: "#0d1b2e",

  border: "1px solid #1e3a5f",

  borderRadius: 8,

  padding: 12,

  height: "100%",

};



function fmtNum(x: unknown, digits: number, fallback = "—"): string {

  if (x == null || x === "") return fallback;

  const n = Number(x);

  if (Number.isNaN(n)) return fallback;

  return n.toFixed(digits);

}



function buildPeBreakdown(marketData: any[]): string {

  const lines = marketData

    .filter((d) => d.pe_ttm != null && !Number.isNaN(Number(d.pe_ttm)) && !d.error)

    .map(

      (d) =>

        `${d.ticker}: PE ${Number(d.pe_ttm).toFixed(1)} × ${((Number(d.weight) || 0) * 100).toFixed(1)}%`

    );

  return lines.length ? lines.join("\n") : "（暂无分项 PE，或抓取失败）";

}



function buildPbBreakdown(marketData: any[]): string {

  const lines = marketData

    .filter((d) => d.pb != null && !Number.isNaN(Number(d.pb)) && !d.error)

    .map(

      (d) =>

        `${d.ticker}: PB ${Number(d.pb).toFixed(2)} × ${((Number(d.weight) || 0) * 100).toFixed(1)}%`

    );

  return lines.length ? lines.join("\n") : "（暂无分项 PB，或抓取失败）";

}



function buildIvBreakdown(marketData: any[]): string {

  const lines = marketData

    .filter((d) => d.implied_volatility != null && !Number.isNaN(Number(d.implied_volatility)) && !d.error)

    .map((d) => {

      const ivPct = (Number(d.implied_volatility) * 100).toFixed(1);

      return `${d.ticker}: IV ${ivPct}% × ${((Number(d.weight) || 0) * 100).toFixed(1)}%`;

    });

  return lines.length ? lines.join("\n") : "（多数为非美股或无期权链，IV 常为空；不参与加权的行不计入分母）";

}



export default function HoldingsDeepAnalysis({ fundName, holdings }: Props) {

  const [loading, setLoading] = useState(false);

  const [marketData, setMarketData] = useState<any[]>([]);

  const [analysis, setAnalysis] = useState<any>(null);

  const [error, setError] = useState("");

  const [step, setStep] = useState<"idle" | "running" | "done">("idle");



  const equityHoldings = holdings.filter(

    (h) =>

      h.type === "equity" &&

      h.ticker &&

      h.ticker.length > 0 &&

      !NON_YF_TICKERS.has(h.ticker)

  );



  async function runAnalysis() {

    if (equityHoldings.length === 0) {

      setError("无可分析的股票持仓（需要 equity 类型且可映射到 yfinance 标的代码）");

      return;

    }



    setLoading(true);

    setError("");

    setStep("running");



    try {

      const payload = {

        fundName,

        holdings: equityHoldings.map((h) => ({ ticker: h.ticker as string, weight: h.weight })),

      };



      const res = await fetch("/api/holdings-analysis", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(payload),

      });

      const data = await res.json();



      if (!res.ok) {

        setError(data?.error || data?.detail || "请求失败");

        setStep("idle");

        return;

      }



      setMarketData(Array.isArray(data.marketData) ? data.marketData : []);

      setAnalysis(data.analysis ?? null);

      setStep("done");



      if (data.analysis?.error) {

        setError(String(data.analysis.error));

      }

    } catch {

      setError(

        "分析失败，请重试（请确认已安装 Python 依赖：`pip install -r scripts/requirements-market.txt`，含 yfinance / akshare）"

      );

      setStep("idle");

    } finally {

      setLoading(false);

    }

  }



  const showResults = analysis && !analysis.error;



  const wpe = analysis?.weighted_pe;

  const wpb = analysis?.weighted_pb;

  const wiv = analysis?.weighted_iv_pct;

  const avgPcr = analysis?.avg_pcr;



  return (

    <div style={{ marginTop: 24, borderTop: "1px solid #1e3a5f", paddingTop: 20 }}>

      <div

        style={{

          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          marginBottom: 16,

          flexWrap: "wrap",

          gap: 12,

        }}

      >

        <div>

          <h3 style={{ color: "#e2e8f0", fontSize: 16, margin: 0 }}>📊 持仓深度分析</h3>

          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>

            Top10 股票持仓：Python{" "}

            <code style={{ fontSize: 11 }}>fetch_market_data.py</code>{" "}

            多源（港 AkShare、韩 Naver、美 yfinance+期权等）→ 加权 PE/PB/IV 计算 → Groq 结构化摘要；MRF / QD

            基金池展开后均可点击标的跳转详情页。卡片标题旁 ⓘ：悬停查看计算逻辑（桌面端）。

          </p>

        </div>

        {step === "idle" && (

          <button

            type="button"

            onClick={runAnalysis}

            disabled={equityHoldings.length === 0}

            style={{

              background: "#0f2744",

              color: "#60a5fa",

              border: "1px solid #3b82f6",

              borderRadius: 8,

              padding: "8px 16px",

              fontSize: 13,

              cursor: equityHoldings.length === 0 ? "not-allowed" : "pointer",

              opacity: equityHoldings.length === 0 ? 0.5 : 1,

            }}

          >

            运行分析

          </button>

        )}

      </div>



      {loading && step === "running" && (

        <div style={{ color: "#94a3b8", fontSize: 13, padding: "16px 0" }}>

          ⏳ 正在抓取市场数据（Python 多源）并运行 Groq 分析（约 10–40 秒，美股期权链较慢）…

        </div>

      )}



      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}



      {showResults && (

        <div>

          <div

            style={{

              display: "grid",

              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",

              gap: 12,

              marginBottom: 16,

            }}

          >

            <Tooltip

              tip={

                `加权 PE：${fmtNum(wpe, 1)}（宽基/全市场历史区间常参考约 18–22，仅作标尺）\n` +

                  `加权 PB：${fmtNum(wpb, 2)}（常见标尺约 2–4，行业差异大）\n\n` +

                  `判断逻辑（示意，非投资建议）：\n` +

                  `· PE 显著高于组合增速预期 → 偏贵\n` +

                  `· PE 处于中等区间 → 合理\n` +

                  `· PE 显著偏低（需结合盈利质量）→ 偏低\n\n` +

                  `当前展示值：PE ${fmtNum(wpe, 1)} / PB ${fmtNum(wpb, 2)}`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>估值位置 ⓘ</div>

                <div

                  style={{

                    color:

                      VALUATION_COLOR[analysis.valuation_level as keyof typeof VALUATION_COLOR] || "#e2e8f0",

                    fontSize: 16,

                    fontWeight: 600,

                  }}

                >

                  {analysis.valuation_level === "overvalued"

                    ? "偏贵"

                    : analysis.valuation_level === "fair"

                      ? "合理"

                      : analysis.valuation_level === "undervalued"

                        ? "偏低"

                        : String(analysis.valuation_level ?? "—")}

                </div>

              </div>

            </Tooltip>



            <Tooltip

              tip={

                `加权 IV：${wiv != null ? `${fmtNum(wiv, 1)}%` : "N/A"}（仅对有期权隐含波动率的成分按权重加权）\n` +

                  `平均 Put/Call Ratio：${avgPcr != null ? fmtNum(avgPcr, 2) : "N/A"}（各成分简单算术平均，含 Beta 代理 PCR）\n\n` +

                  `判断逻辑（示意）：\n` +

                  `· IV 偏高 + Put 成交相对多 → 偏恐慌/对冲需求\n` +

                  `· IV 中等 → 中性\n` +

                  `· IV 偏低 + Call 相对多 → 偏乐观/追涨\n\n` +

                  `数据来源：美股优先期权链成交量；港股/韩股等常无 IV，用 Beta 估算 PCR。`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>市场情绪 ⓘ</div>

                <div

                  style={{

                    color:

                      SENTIMENT_COLOR[analysis.market_sentiment as keyof typeof SENTIMENT_COLOR] || "#e2e8f0",

                    fontSize: 16,

                    fontWeight: 600,

                  }}

                >

                  {analysis.market_sentiment === "fear"

                    ? "偏谨慎"

                    : analysis.market_sentiment === "neutral"

                      ? "中性"

                      : analysis.market_sentiment === "optimistic"

                        ? "偏乐观"

                        : String(analysis.market_sentiment ?? "—")}

                </div>

              </div>

            </Tooltip>



            <Tooltip

              tip={

                `综合判断：估值（PE）× 波动预期（IV）等信号叠加（由模型归纳）。\n\n` +

                  `常见解读（示意）：\n` +

                  `· 高 PE + 高 IV → 定价偏热且波动大 → 风险偏高\n` +

                  `· 高 PE + 低 IV → 波动定价偏低 → 留意自满/拥挤\n` +

                  `· 低 PE + 高 IV → 悲观与波动定价 → 可能错杀或承压\n` +

                  `· 低 PE + 低 IV → 相对平静\n\n` +

                  `当前：PE ${fmtNum(wpe, 1)} / IV ${wiv != null ? `${fmtNum(wiv, 1)}%` : "N/A"}`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>风险信号 ⓘ</div>

                <div

                  style={{

                    color:

                      analysis.risk_signal === "high"

                        ? "#ef4444"

                        : analysis.risk_signal === "medium"

                          ? "#f59e0b"

                          : "#22c55e",

                    fontSize: 16,

                    fontWeight: 600,

                  }}

                >

                  {analysis.risk_signal === "high" ? "高" : analysis.risk_signal === "medium" ? "中" : "低"}

                </div>

              </div>

            </Tooltip>



            <Tooltip

              tip={

                `在估值、情绪、风险等标签基础上的粗粒度汇总（非买卖指令）。\n\n` +

                  `关注：估值偏低 + 情绪中性或偏谨慎\n` +

                  `观望：估值合理或多信号相互抵消\n` +

                  `回避：估值偏高 + 风险偏高 + 情绪偏乐观（拥挤）\n\n` +

                  `置信度：${analysis.confidence ?? "—"}\n` +

                  `数据覆盖：${analysis.data_coverage ?? "—"}`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>参考方向 ⓘ</div>

                <div

                  style={{

                    color:

                      ACTION_COLOR[analysis.investment_action as keyof typeof ACTION_COLOR] || "#e2e8f0",

                    fontSize: 16,

                    fontWeight: 600,

                  }}

                >

                  {analysis.investment_action === "buy"

                    ? "相对占优"

                    : analysis.investment_action === "hold"

                      ? "中性"

                      : analysis.investment_action === "avoid"

                        ? "偏谨慎"

                        : String(analysis.investment_action ?? "—")}

                </div>

              </div>

            </Tooltip>

          </div>



          <div

            style={{

              display: "grid",

              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",

              gap: 12,

              marginBottom: 16,

            }}

          >

            <Tooltip

              tip={

                `计算方式：Σ(各成分 PE × 权重) / Σ(有 PE 的成分权重)\n\n` +

                  `参与加权的持仓：\n` +

                  buildPeBreakdown(marketData) +

                  `\n\n参考区间（仅科普）：成长股常见 25–40；价值/蓝筹常 10–18（因行业而异）`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11 }}>加权 PE ⓘ</div>

                <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 600 }}>

                  {analysis.weighted_pe != null ? Number(analysis.weighted_pe).toFixed(1) : "N/A"}

                </div>

              </div>

            </Tooltip>



            <Tooltip

              tip={

                `计算方式：Σ(各成分 PB × 权重) / Σ(有 PB 的成分权重)\n\n` +

                  `参与加权的持仓：\n` +

                  buildPbBreakdown(marketData) +

                  `\n\n金融、资源等行业 PB 通常偏低；轻资产科技 PB 常偏高。`

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11 }}>加权 PB ⓘ</div>

                <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 600 }}>

                  {analysis.weighted_pb != null ? Number(analysis.weighted_pb).toFixed(2) : "N/A"}

                </div>

              </div>

            </Tooltip>



            <Tooltip

              tip={

                `计算方式：Σ(各成分 IV × 权重) / Σ(有 IV 的成分权重)\n` +

                  `（IV 为小数，如 0.32 表示约 32%；展示为百分比）\n\n` +

                  `参与加权的持仓：\n` +

                  buildIvBreakdown(marketData)

              }

            >

              <div style={{ ...cardShell, cursor: "help" }}>

                <div style={{ color: "#64748b", fontSize: 11 }}>加权 IV ⓘ</div>

                <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 600 }}>

                  {analysis.weighted_iv_pct != null ? `${Number(analysis.weighted_iv_pct).toFixed(1)}%` : "N/A"}

                </div>

              </div>

            </Tooltip>

          </div>



          {analysis.key_driver && (

            <div style={{ background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 8, padding: 12, marginBottom: 8 }}>

              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>核心驱动</div>

              <div style={{ color: "#e2e8f0", fontSize: 13 }}>{analysis.key_driver}</div>

            </div>

          )}

          {analysis.top_warning && (

            <div style={{ background: "#1a0f0f", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 8 }}>

              <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 4 }}>⚠️ 主要风险</div>

              <div style={{ color: "#fca5a5", fontSize: 13 }}>{analysis.top_warning}</div>

            </div>

          )}



          <div style={{ color: "#475569", fontSize: 11, marginTop: 12 }}>

            数据覆盖：{analysis.data_coverage ?? "—"} · 置信度：{analysis.confidence ?? "—"} · 平均 PCR：

            {avgPcr != null ? fmtNum(avgPcr, 2) : "—"} · 仅供参考，不构成投资建议

          </div>



          <button

            type="button"

            onClick={() => {

              setAnalysis(null);

              setMarketData([]);

              setStep("idle");

              setError("");

            }}

            style={{

              marginTop: 12,

              background: "transparent",

              color: "#475569",

              border: "1px solid #1e3a5f",

              borderRadius: 6,

              padding: "4px 12px",

              fontSize: 11,

              cursor: "pointer",

            }}

          >

            重新分析

          </button>

        </div>

      )}



      {marketData.length > 0 && (

        <details style={{ marginTop: 16 }}>

          <summary style={{ color: "#64748b", fontSize: 12, cursor: "pointer" }}>查看个股原始数据</summary>

          <table style={{ width: "100%", fontSize: 12, marginTop: 8, borderCollapse: "collapse" }}>

            <thead>

              <tr style={{ color: "#64748b", textAlign: "left" }}>

                <th style={{ padding: "4px 8px" }}>股票</th>

                <th style={{ padding: "4px 8px" }}>详情</th>

                <th style={{ padding: "4px 8px" }}>权重</th>

                <th style={{ padding: "4px 8px" }}>PE</th>

                <th style={{ padding: "4px 8px" }}>PB</th>

                <th style={{ padding: "4px 8px" }}>IV</th>

                <th style={{ padding: "4px 8px" }}>PCR</th>

                <th style={{ padding: "4px 8px" }}>数据源</th>

                <th style={{ padding: "4px 8px" }}>质量</th>

              </tr>

            </thead>

            <tbody>

              {marketData.map((d: any, i: number) => (

                <tr key={i} style={{ borderTop: "1px solid #1e3a5f", color: d.error ? "#475569" : "#e2e8f0" }}>

                  <td style={{ padding: "4px 8px" }}>{d.ticker}</td>

                  <td style={{ padding: "4px 8px" }}>

                    {d.ticker && !d.error ? (

                      <Link

                        href={`/stock/${encodeURIComponent(String(d.ticker))}`}

                        style={{ color: "#60a5fa", fontSize: 12 }}

                        target="_blank"

                        rel="noopener noreferrer"

                      >

                        打开

                      </Link>

                    ) : (

                      "—"

                    )}

                  </td>

                  <td style={{ padding: "4px 8px" }}>{((d.weight ?? 0) * 100).toFixed(1)}%</td>

                  <td style={{ padding: "4px 8px" }}>{d.pe_ttm != null ? Number(d.pe_ttm).toFixed(1) : "—"}</td>

                  <td style={{ padding: "4px 8px" }}>{d.pb != null ? Number(d.pb).toFixed(2) : "—"}</td>

                  <td style={{ padding: "4px 8px" }}>

                    {d.implied_volatility != null ? `${(Number(d.implied_volatility) * 100).toFixed(1)}%` : "—"}

                  </td>

                  <td style={{ padding: "4px 8px" }}>{d.put_call_ratio != null ? Number(d.put_call_ratio).toFixed(2) : "—"}</td>

                  <td style={{ padding: "4px 8px", fontSize: 11 }}>{d.data_source ?? "—"}</td>

                  <td style={{ padding: "4px 8px" }}>{d.data_quality ?? "—"}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </details>

      )}

    </div>

  );

}

