"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => !loading && username.trim().length > 0 && password.length > 0,
    [loading, username, password]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "登录失败");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(900px 540px at 20% 10%, rgba(24,95,165,0.28), transparent 55%), radial-gradient(700px 500px at 80% 20%, rgba(96,165,250,0.18), transparent 55%), #0a0e1a",
        padding: "24px 16px",
        fontFamily: 'Inter, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(10px)",
            }}
          >
            <span style={{ color: "#60A5FA", fontSize: 18 }}>◆</span>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>
              ATLAS
            </span>
            <span style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 500 }}>
              Market Portfolio
            </span>
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(10,14,26,0.78)",
            backdropFilter: "blur(14px)",
            boxShadow:
              "0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: 22,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>登录</div>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6 }}>
              Cookie 有效期 30 天，无需重复输入密码
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <label style={{ display: "block", marginBottom: 10 }}>
              <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>
                用户名
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                inputMode="text"
                spellCheck={false}
                placeholder="请输入用户名"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#F9FAFB",
                  padding: "10px 12px",
                  outline: "none",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>
                密码
              </div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
                type="password"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#F9FAFB",
                  padding: "10px 12px",
                  outline: "none",
                }}
              />
            </label>

            {error && (
              <div
                role="alert"
                style={{
                  color: "#FCA5A5",
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: canSubmit ? "#185FA5" : "rgba(255,255,255,0.08)",
                color: canSubmit ? "#F9FAFB" : "#9CA3AF",
                padding: "10px 12px",
                fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <div
            style={{
              marginTop: 12,
              color: "#6B7280",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            没有账号？请联系管理员获取密码
          </div>
        </div>
      </div>
    </div>
  );
}

