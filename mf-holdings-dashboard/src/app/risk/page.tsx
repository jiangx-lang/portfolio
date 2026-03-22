"use client";

import PasswordGate from "@/components/PasswordGate";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReportItem = {
  name: string;
  mtimeMs: number;
  label: string;
  fileTimeMs?: number | null;
  mtimeZh?: string;
};

export default function RiskPage() {
  return (
    <PasswordGate title="宏观风险监控">
      <RiskPageInner />
    </PasswordGate>
  );
}

function RiskPageInner() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [imgNonce, setImgNonce] = useState(0);

  const loadList = useCallback(() => {
    setListLoading(true);
    setListError(false);
    fetch(`/api/risk-report-long-list?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("list failed");
        return r.json();
      })
      .then((d: { reports?: ReportItem[] }) => {
        const reps = Array.isArray(d.reports) ? d.reports : [];
        setReports(reps);
        setListLoading(false);
        if (reps.length === 0) {
          setListError(true);
          return;
        }
        setListError(false);
        setSelected((prev) => {
          if (prev && reps.some((x) => x.name === prev)) return prev;
          return reps[0].name;
        });
        setImgNonce((n) => n + 1);
      })
      .catch(() => {
        setListLoading(false);
        setListError(true);
      });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const currentMeta = useMemo(
    () => reports.find((r) => r.name === selected),
    [reports, selected]
  );

  const imgSrc = useMemo(() => {
    if (!selected) return "";
    return `/api/risk-report-long?name=${encodeURIComponent(selected)}&v=${imgNonce}`;
  }, [selected, imgNonce]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 第一行：标题 */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1e3a5f",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <a
          href="/"
          style={{
            color: "#64748b",
            fontSize: "13px",
            textDecoration: "none",
          }}
        >
          ← 返回首页
        </a>
        <span style={{ color: "#e2e8f0", fontSize: "15px", fontWeight: 600 }}>
          🚨 宏观风险监控
        </span>
        <span style={{ color: "#64748b", fontSize: "12px" }}>
          FRED 长图 · 仅供参考
        </span>
      </div>

      {/* 第二行：报告选择（整行，避免被顶栏挤没） */}
      <div
        style={{
          padding: "12px 16px 14px",
          background: "#0d1b2e",
          borderBottom: "1px solid #1e3a5f",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
            选择报告日期
          </span>
          <button
            type="button"
            onClick={() => {
              loadList();
              setImgError(false);
            }}
            disabled={listLoading}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #334155",
              background: "transparent",
              color: "#94a3b8",
              cursor: listLoading ? "wait" : "pointer",
            }}
          >
            {listLoading ? "刷新中…" : "刷新列表"}
          </button>
          {reports.length > 0 && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              共 {reports.length} 份（按文件名日期新→旧，SCP 后也以文件名为准）
            </span>
          )}
        </div>

        {reports.length > 0 && (
          <>
            <select
              value={selected ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setImgError(false);
                setSelected(v);
                setImgNonce((n) => n + 1);
              }}
              style={{
                width: "100%",
                maxWidth: 560,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #3b82f6",
                background: "#0f2744",
                color: "#f1f5f9",
                fontSize: 14,
                display: "block",
              }}
            >
              {reports.map((r, i) => (
                <option key={r.name} value={r.name}>
                  {i === 0 ? "【最新】 " : ""}
                  {r.label}
                  {r.mtimeZh ? ` · 上传/mtime ${r.mtimeZh}` : ""}
                </option>
              ))}
            </select>
            {currentMeta && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.5,
                  wordBreak: "break-all",
                }}
              >
                当前文件：<code style={{ color: "#94a3b8" }}>{currentMeta.name}</code>
                <br />
                排序依据：文件名中的日期时间（若存在）；若无则看服务器 mtime。
              </p>
            )}
          </>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 12px 32px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {listLoading && reports.length === 0 ? (
          <p
            style={{
              color: "#64748b",
              textAlign: "center",
              padding: "48px 16px",
              fontSize: 14,
            }}
          >
            加载报告列表…
          </p>
        ) : listError || !selected ? (
          <p
            style={{
              color: "#94a3b8",
              textAlign: "center",
              padding: "48px 16px",
              fontSize: 14,
            }}
          >
            暂无可选长图。请将{" "}
            <code style={{ color: "#cbd5e1" }}>crisis_report_long_YYYYMMDD_HHMMSS.png</code>{" "}
            同步到服务器{" "}
            <code style={{ color: "#cbd5e1" }}>
              /root/fredmonitor/outputs/crisis_monitor/
            </code>
            ，再点「刷新列表」。部署后若仍如此，请确认已{" "}
            <code style={{ color: "#cbd5e1" }}>git pull</code> 并{" "}
            <code style={{ color: "#cbd5e1" }}>npm run build</code> 且已重启进程。
          </p>
        ) : imgError ? (
          <p
            style={{
              color: "#94a3b8",
              textAlign: "center",
              padding: "48px 16px",
              fontSize: 14,
            }}
          >
            该版本图片加载失败。请换选其它日期或点「刷新列表」。
          </p>
        ) : (
          <img
            key={`${selected}-${imgNonce}`}
            src={imgSrc}
            alt="宏观风险监控报告长图"
            onError={() => setImgError(true)}
            loading="eager"
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 1100,
              height: "auto",
              margin: "0 auto",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          />
        )}
      </div>
    </div>
  );
}
