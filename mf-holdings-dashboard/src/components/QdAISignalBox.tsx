"use client";

import { useEffect, useMemo, useState } from "react";

type AIResult = {
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

type CachedRow = AIResult & { generated_at?: string };

const SIGNAL_COLOR: Record<string, string> = {
  strong_buy: "#1D9E75",
  buy: "#185FA5",
  hold: "#888780",
  trim: "#BA7517",
  sell: "#D85A30",
};

const SIGNAL_LABEL: Record<string, string> = {
  strong_buy: "积极关注",
  buy: "关注",
  hold: "中性",
  trim: "谨慎",
  sell: "高风险示意",
};

export function QdAISignalBox({ code }: { code: string }) {
  const [result, setResult] = useState<AIResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fundCode = useMemo(() => code.trim().toUpperCase(), [code]);

  useEffect(() => {
    let cancelled = false;
    async function loadCache() {
      if (!fundCode) return;
      try {
        const res = await fetch(`/api/analysis/${encodeURIComponent(fundCode)}?fund_type=QD`);
        const data = (await res.json()) as CachedRow | null;
        if (cancelled) return;
        if (data && data.summary) {
          const { generated_at, ...rest } = data;
          setResult(rest);
          setGeneratedAt(generated_at ? String(generated_at) : "");
        } else {
          setResult(null);
          setGeneratedAt("");
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          setGeneratedAt("");
        }
      }
    }
    loadCache();
    return () => {
      cancelled = true;
    };
  }, [fundCode]);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      // QD holdings 从 holdings API（内部会走 sqlite）
      const hRes = await fetch(`/api/mrf/holdings/${encodeURIComponent(fundCode)}`);
      const hData = await hRes.json();
      const top = Array.isArray(hData?.holdings) ? hData.holdings.slice(0, 10) : [];
      const top5 = top.slice(0, 5).map((h: any) => ({
        name: String(h.holding_name_std || h.holding_name_raw || ""),
        weight_pct: Number(h.weight_pct ?? 0),
        holding_type: h.holding_type,
      }));

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType: "qd_fund",
          fundData: {
            primary_code: fundCode,
            fund_name_cn: String(hData?.fund ?? fundCode),
            holdings: top5,
          },
        }),
      });
      const ai = await res.json();
      if (!res.ok || ai.error) {
        setError(typeof ai.error === "string" ? ai.error : "生成失败，请重试");
        setResult(null);
        return;
      }
      setResult(ai as AIResult);

      // 写入缓存
      try {
        const saveRes = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fund_code: fundCode,
            fund_type: "QD",
            fund_name: String(hData?.fund ?? fundCode),
            ...(ai as AIResult),
          }),
        });
        const saved = (await saveRes.json()) as { generated_at?: string } | null;
        if (saveRes.ok && saved?.generated_at) setGeneratedAt(String(saved.generated_at));
      } catch {
        // ignore
      }
    } catch {
      setError("生成失败，请重试");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    box: {
      background: "#111827",
      border: "0.5px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "1rem 1.25rem",
      marginTop: "1rem",
    },
    label: {
      fontSize: 10,
      color: "#9CA3AF",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginBottom: 6,
    },
    btn: {
      padding: "8px 18px",
      borderRadius: 8,
      border: "0.5px solid rgba(255,255,255,0.15)",
      background: "transparent",
      color: "#60A5FA",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    signal: (sig: string) => ({
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: 6,
      background: (SIGNAL_COLOR[sig] || "#888") + "22",
      color: SIGNAL_COLOR[sig] || "#888",
      fontWeight: 500,
      fontSize: 14,
    }),
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 },
    item: { background: "#1F2937", borderRadius: 8, padding: "0.75rem" },
    ititle: { fontSize: 10, color: "#6B7280", marginBottom: 4 },
    itext: { fontSize: 13, color: "#F9FAFB", lineHeight: 1.5 },
    list: { paddingLeft: 16, margin: 0, fontSize: 13, color: "#F9FAFB", lineHeight: 1.7 },
  };

  return (
    <div style={s.box}>
      <div style={s.label}>🤖 QDII 公开信息摘要</div>

      {!result && !loading && (
        <button type="button" style={s.btn} onClick={analyze}>
          生成摘要 ↗
        </button>
      )}

      {loading && <div style={{ color: "#9CA3AF", fontSize: 13 }}>生成中，请稍候…</div>}
      {error && <div style={{ color: "#D85A30", fontSize: 13 }}>{error}</div>}

      {result && (
        <div>
          {generatedAt && (
            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
              上次生成时间：{String(generatedAt).replace("T", " ").slice(0, 19)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={s.signal(result.signal)}>{SIGNAL_LABEL[result.signal] || result.signal}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>置信度 {result.confidence}%</span>
            <button
              type="button"
              style={{ ...s.btn, fontSize: 11, padding: "4px 10px", marginLeft: "auto" }}
              onClick={analyze}
            >
              重新生成
            </button>
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#F9FAFB",
              marginBottom: 12,
              borderLeft: "2px solid #185FA5",
              paddingLeft: 10,
            }}
          >
            {result.summary}
          </div>

          <div style={s.grid}>
            <div style={s.item}>
              <div style={s.ititle}>策略说明</div>
              <div style={s.itext}>{result.thesis}</div>
            </div>
            <div style={s.item}>
              <div style={s.ititle}>风险特征（标签）</div>
              <div style={s.itext}>{result.suitable_investor}</div>
            </div>
            <div style={s.item}>
              <div style={s.ititle}>核心优势</div>
              <ul style={s.list}>
                {result.strengths?.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ul>
            </div>
            <div style={s.item}>
              <div style={s.ititle}>主要风险</div>
              <ul style={s.list}>
                {result.risks?.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div style={s.item}>
              <div style={s.ititle}>费率评价</div>
              <div style={s.itext}>{result.fee_assessment}</div>
            </div>
            <div style={s.item}>
              <div style={s.ititle}>持仓点评</div>
              <div style={s.itext}>{result.allocation_comment}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "0.75rem",
              background: "#185FA511",
              borderRadius: 8,
              borderLeft: "2px solid #185FA5",
            }}
          >
            <div style={s.ititle}>数据观察要点</div>
            <div style={{ fontSize: 13, color: "#F9FAFB", lineHeight: 1.6 }}>{result.recommendation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

