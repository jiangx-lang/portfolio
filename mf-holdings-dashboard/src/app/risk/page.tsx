"use client";

import Link from "next/link";
import PasswordGate from "@/components/PasswordGate";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-navy">
      {/* 头部：eyebrow + font-display 标题 */}
      <header className="border-b border-white/[0.07] px-4 pb-6 pt-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">MACRO RISK MONITOR</span>
            <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
              宏观风险监控
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              FRED 长图 · 仅供参考
            </p>
          </div>
          <Link href="/" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </header>

      {/* 报告选择栏 */}
      <section className="border-b border-white/[0.07] bg-navy-soft px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              选择报告日期
            </span>
            <button
              type="button"
              onClick={() => {
                loadList();
                setImgError(false);
              }}
              disabled={listLoading}
              className="btn-ghost disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`}
              />
              {listLoading ? "刷新中…" : "刷新列表"}
            </button>
            {reports.length > 0 && (
              <span className="text-xs text-slate-500">
                共 <span className="num">{reports.length}</span>{" "}
                份（按文件名日期新→旧，SCP 后也以文件名为准）
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
                className="block w-full max-w-xl rounded-xl border border-white/[0.07] bg-navy-card px-4 py-3 text-sm text-slate-100 outline-none transition-colors focus:border-gold/60"
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
                <p className="mt-3 break-all text-xs leading-relaxed text-slate-500">
                  当前文件：
                  <code className="font-mono text-slate-400">
                    {currentMeta.name}
                  </code>
                  <br />
                  排序依据：文件名中的日期时间（若存在）；若无则看服务器 mtime。
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* 长图查看区 */}
      <main className="flex-1 overflow-auto px-3 py-6 pb-12 sm:px-6">
        {listLoading && reports.length === 0 ? (
          <div className="glass-card animate-in mx-auto max-w-xl p-10 text-center text-sm text-slate-400">
            加载报告列表…
          </div>
        ) : listError || !selected ? (
          <div className="glass-card animate-in mx-auto max-w-xl p-10 text-center text-sm leading-relaxed text-slate-400">
            暂无可选长图。请将{" "}
            <code className="font-mono text-slate-300">
              crisis_report_long_YYYYMMDD_HHMMSS.png
            </code>{" "}
            同步到服务器{" "}
            <code className="font-mono text-slate-300">
              /root/fredmonitor/outputs/crisis_monitor/
            </code>
            ，再点「刷新列表」。部署后若仍如此，请确认已{" "}
            <code className="font-mono text-slate-300">git pull</code> 并{" "}
            <code className="font-mono text-slate-300">npm run build</code>{" "}
            且已重启进程。
          </div>
        ) : imgError ? (
          <div className="glass-card animate-in mx-auto max-w-xl p-10 text-center text-sm text-slate-400">
            该版本图片加载失败。请换选其它日期或点「刷新列表」。
          </div>
        ) : (
          <div className="glass-panel animate-in mx-auto max-w-[1100px] overflow-hidden p-2 sm:p-3">
            <img
              key={`${selected}-${imgNonce}`}
              src={imgSrc}
              alt="宏观风险监控报告长图"
              onError={() => setImgError(true)}
              loading="eager"
              decoding="async"
              className="block h-auto w-full rounded-lg bg-white"
            />
          </div>
        )}
      </main>
    </div>
  );
}
