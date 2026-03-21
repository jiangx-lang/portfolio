"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

const STREAMLIT_URL =
  process.env.NEXT_PUBLIC_STREAMLIT_URL || "https://streamlit.atlasallocations.com";

const STORAGE_SKIP = "atlas_landing_skip";
const STORAGE_REDIRECT = "atlas_home_redirect";

const VALID_REDIRECTS = ["/portfolio", "/mrf", "/qd"] as const;

function persistAndGo(redirectPath: string, navigate: () => void) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_SKIP, "1");
  localStorage.setItem(STORAGE_REDIRECT, redirectPath);
  navigate();
}

/** 与 Streamlit `app.py` → `render_landing_page` 版式对齐；设备切换在 Next 侧用路由/新标签近似 */
export default function LandingSelector() {
  const router = useRouter();
  const { isMobile } = useIsMobile();
  const [phase, setPhase] = useState<"checking" | "show">("checking");

  useEffect(() => {
    try {
      const skip = localStorage.getItem(STORAGE_SKIP);
      const path = localStorage.getItem(STORAGE_REDIRECT);
      if (
        skip === "1" &&
        path &&
        (VALID_REDIRECTS as readonly string[]).includes(path)
      ) {
        router.replace(path);
        return;
      }
    } catch {
      /* ignore */
    }
    setPhase("show");
  }, [router]);

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

  /** 仅打开锦城 Streamlit（WMP/笔记/播客/管理员模块在 Streamlit 内） */
  const openStreamlit = (afterPersist?: string) => {
    const p = afterPersist ?? "/portfolio";
    persistAndGo(p, () => {
      window.open(STREAMLIT_URL, "_blank", "noopener,noreferrer");
      router.push(p);
    });
  };

  if (phase === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0f1e",
        }}
      />
    );
  }

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
                onClick={() =>
                  persistAndGo("/qd", () => router.push("/qd"))
                }
              >
                📱 手机端
              </button>
              <button
                type="button"
                style={deviceBtn}
                onClick={() =>
                  persistAndGo("/qd", () => {
                    window.open(STREAMLIT_URL, "_blank", "noopener,noreferrer");
                    router.push("/qd");
                  })
                }
              >
                🖥️ 电脑端
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              手机端：Next QD 基金池；电脑端：另开锦城 Streamlit（组合构建器等全功能）
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
                onClick={() =>
                  persistAndGo("/mrf", () => router.push("/mrf"))
                }
              >
                📱 手机端
              </button>
              <button
                type="button"
                style={deviceBtn}
                onClick={() =>
                  persistAndGo("/portfolio", () => router.push("/portfolio"))
                }
              >
                🖥️ 电脑端
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
              手机端：MRF 列表与穿透；电脑端：Next Model Portfolio（SCB 标准组合）
            </p>
          </div>
        </div>

        {/* WMP — 仅 Streamlit 有模块 */}
        <div style={{ marginTop: 8 }}>
          <div style={{ ...cardInner, marginBottom: 12 }}>
            <div style={tagStyle}>WMP NAV</div>
            <div style={titleStyle}>🏦 WMP 净值</div>
            <div style={descStyle}>抓取与查看 WMP 净值数据</div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              maxWidth: isMobile ? "100%" : 480,
            }}
          >
            <button
              type="button"
              style={deviceBtn}
              onClick={() => openStreamlit("/portfolio")}
            >
              📱 手机端
            </button>
            <button
              type="button"
              style={deviceBtn}
              onClick={() => openStreamlit("/portfolio")}
            >
              🖥️ 电脑端
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
            将打开锦城 Streamlit，请在应用内选择 WMP 净值入口
          </p>
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
              <button
                type="button"
                style={{ ...deviceBtn, marginTop: 4 }}
                onClick={() => openStreamlit("/portfolio")}
              >
                进入市场笔记 →
              </button>
            </div>
            <div>
              <div style={bottomCard}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎙️</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>播客</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  音频市场解读
                </div>
              </div>
              <button
                type="button"
                style={{ ...deviceBtn, marginTop: 4 }}
                onClick={() => openStreamlit("/portfolio")}
              >
                进入播客 →
              </button>
            </div>
            <div>
              <div style={bottomCard}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>管理员</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  内容管理后台
                </div>
              </div>
              <button
                type="button"
                style={{ ...deviceBtn, marginTop: 4 }}
                onClick={() => openStreamlit("/portfolio")}
              >
                🔐 管理员
              </button>
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
            onClick={() =>
              persistAndGo("/portfolio", () => router.push("/portfolio"))
            }
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
