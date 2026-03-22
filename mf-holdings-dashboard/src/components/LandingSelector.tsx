"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

/** 构建期注入；勿与 Next 本站同 URL，否则当前页跳转等于无反应 */
const STREAMLIT_HREF = (
  process.env.NEXT_PUBLIC_STREAMLIT_URL?.trim() || "https://streamlit.atlasallocations.com"
).replace(/\/$/, "");

/** Streamlit app.py 深链：?entry=wmp|qdii|mrf|… */
function streamlitWithEntry(entry: string) {
  const base = STREAMLIT_HREF.includes("://")
    ? STREAMLIT_HREF
    : `https://${STREAMLIT_HREF.replace(/^\/+/, "")}`;
  try {
    const u = new URL(base);
    u.searchParams.set("entry", entry);
    return u.toString();
  } catch {
    const join = STREAMLIT_HREF.includes("?") ? "&" : "?";
    return `${STREAMLIT_HREF}${join}entry=${encodeURIComponent(entry)}`;
  }
}

const streamlitLinkStyle = (
  base: React.CSSProperties
): React.CSSProperties => ({
  ...base,
  display: "inline-block",
  boxSizing: "border-box",
  textAlign: "center",
  textDecoration: "none",
});

/** 与 Streamlit `app.py` → `render_landing_page` 版式对齐；设备切换在 Next 侧用路由/新标签近似 */
export default function LandingSelector() {
  const router = useRouter();
  const { isMobile } = useIsMobile();

  const cardInner = {
    background: "#0d1b2e",
    border: "1px solid #1e3a5f",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "12px",
  } as const;

  const tagStyle: React.CSSProperties = {
    color: "#60a5fa",
    fontSize: 12,
    letterSpacing: "2px",
    marginBottom: 8,
  };

  const titleStyle: React.CSSProperties = {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  };

  const descStyle: React.CSSProperties = {
    color: "#94a3b8",
    fontSize: 13,
  };

  const deviceBtn: React.CSSProperties = {
    background: "#0f2744",
    color: "#60a5fa",
    border: "1px solid #3b82f6",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
  };

  const bottomCard: React.CSSProperties = {
    background: "#0d1b2e",
    border: "1px solid #1e3a5f",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
    marginBottom: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        color: "#e2e8f0",
        padding: "24px 16px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {/* Header — 与 Streamlit 落地页一致 */}
        <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
          <div
            style={{
              fontSize: 13,
              color: "#3b82f6",
              letterSpacing: "3px",
              marginBottom: 8,
            }}
          >
            ◆ ATLAS
          </div>
          <h1
            style={{
              color: "#e2e8f0",
              fontSize: isMobile ? 26 : 32,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Market Portfolio
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
            Model Portfolio 数据展示 · 市场资讯分享 · 不构成任何投资建议
          </p>
        </div>
        <p
          style={{
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          请选择入口与设备
        </p>
        <hr
          style={{
            border: "none",
            borderTop: "1px solid #1e3a5f",
            margin: "0 0 28px",
          }}
        />

        {/* QDII | MRF */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "16px",
            marginBottom: 8,
          }}
        >
          {/* QDII */}
          <div>
            <div style={cardInner}>
              <div style={tagStyle}>QDII PORTFOLIO</div>
              <div style={titleStyle}>🏦 锦城轮动 · QDII</div>
              <div style={descStyle}>
                QDII 基金组合构建器 · 主题搜索 · 历史业绩
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                style={deviceBtn}
                onClick={() => router.push("/qd")}
              >
                📱 手机端
              </button>
              <button
                type="button"
                style={deviceBtn}
                onClick={() => router.push("/qd")}
              >
                🖥️ 电脑端
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              手机端与电脑端均进入 Next QD 基金池
            </p>
          </div>

          {/* MRF */}
          <div>
            <div style={cardInner}>
              <div style={tagStyle}>MRF PORTFOLIO</div>
              <div style={titleStyle}>🌐 锦城轮动 · MRF</div>
              <div style={descStyle}>
                MRF 基金池 · SCB 组合构建 · 穿透分析
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                style={deviceBtn}
                onClick={() => router.push("/mrf")}
              >
                📱 手机端
              </button>
              <button
                type="button"
                style={deviceBtn}
                onClick={() => router.push("/portfolio")}
              >
                🖥️ 电脑端
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              手机端：MRF 列表与穿透；电脑端：Next Model Portfolio（SCB 标准组合）
            </p>
          </div>
        </div>

        {/* WMP | MRF Pool — 与 QDII/MRF 行相同响应式栅格 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "16px",
            marginTop: 8,
          }}
        >
          <div>
            <div style={cardInner}>
              <div style={tagStyle}>WMP NAV</div>
              <div style={titleStyle}>🏦 WMP 净值</div>
              <div style={descStyle}>抓取与查看 WMP 净值数据</div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <a href={streamlitWithEntry("wmp")} style={streamlitLinkStyle(deviceBtn)}>
                📱 手机端
              </a>
              <a href={streamlitWithEntry("wmp")} style={streamlitLinkStyle(deviceBtn)}>
                🖥️ 电脑端
              </a>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              直达锦城 Streamlit · WMP 净值
            </p>
          </div>

          <div>
            <div style={cardInner}>
              <div style={tagStyle}>MRF POOL</div>
              <div style={titleStyle}>🌏 MRF 基金池</div>
              <div style={descStyle}>
                16只互认基金 · 地域筛选 · 主题分析
              </div>
            </div>
            <a
              href="https://atlasallocations.com/mrf"
              target="_blank"
              rel="noopener noreferrer"
              style={streamlitLinkStyle(deviceBtn)}
            >
              进入基金池 →
            </a>
          </div>
        </div>

        {/* 市场笔记 · 播客 · 管理员 */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            <div>
              <div style={bottomCard}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>市场笔记</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  市场观察与分析
                </div>
              </div>
              <Link
                href="/notes"
                style={streamlitLinkStyle({ ...deviceBtn, marginTop: 4 })}
              >
                进入市场笔记 →
              </Link>
            </div>
            <div>
              <div style={bottomCard}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎙️</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>播客</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  音频市场解读
                </div>
              </div>
              <Link
                href="/podcast"
                style={streamlitLinkStyle({ ...deviceBtn, marginTop: 4 })}
              >
                进入播客 →
              </Link>
            </div>
            <div>
              <div style={bottomCard}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>管理员</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  内容管理后台
                </div>
              </div>
              <Link
                href="/admin"
                style={streamlitLinkStyle({ ...deviceBtn, marginTop: 4 })}
              >
                🔐 管理员
              </Link>
            </div>
          </div>
        </div>

        {/* Model Portfolio 快捷（Next 独有，窄条） */}
        <div
          style={{
            marginTop: 28,
            padding: "16px",
            background: "rgba(24,95,165,0.12)",
            border: "1px solid rgba(59,130,246,0.35)",
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "#94a3b8" }}>
            Next 站内 ·{" "}
          </span>
          <button
            type="button"
            onClick={() => router.push("/portfolio")}
            style={{
              background: "none",
              border: "none",
              color: "#60a5fa",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
            }}
          >
            📊 Model Portfolio（SCB 标准组合）
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid #1e3a5f",
            fontSize: 12,
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          本平台所有内容仅为市场数据展示与资讯分享，不构成任何投资建议。
          <br />
          投资涉及风险，请咨询持牌理财顾问后自行决策。
        </div>
      </div>
    </div>
  );
}
