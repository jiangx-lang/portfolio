"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: "2rem",
        color: "#F9FAFB",
        textAlign: "center" as const,
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 16, color: "#D85A30", marginBottom: 12 }}>
        页面加载出错
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 16 }}>
        {error.message}
      </div>
      <button
        onClick={reset}
        style={{
          padding: "8px 18px",
          borderRadius: 8,
          border: "0.5px solid rgba(255,255,255,0.15)",
          background: "transparent",
          color: "#60A5FA",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        重试
      </button>
    </div>
  );
}
