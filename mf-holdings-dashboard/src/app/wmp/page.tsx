"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

type WmpRow = {
  product_code: string;
  product_name: string;
  risk_level: string;
  term: string;
  nav: number;
  daily_yield: string;
  yield_1w: string;
  yield_1m: string;
  yield_3m: string;
};

type ApiPayload = {
  rows: WmpRow[];
  asOfDate: string | null;
  latestDate: string | null;
  error: string | null;
};

/** CSV 中最新一条日期（本地日历日）的次日起到今天（含）之间的工作日数；周末不计入。 */
function parseLocalDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

function countBusinessDaysAfterLatestToTodayInclusive(
  latest: Date,
  today: Date
): number {
  const start = new Date(
    latest.getFullYear(),
    latest.getMonth(),
    latest.getDate()
  );
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let count = 0;
  const cur = new Date(start);
  for (;;) {
    cur.setDate(cur.getDate() + 1);
    if (cur > end) break;
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) count += 1;
  }
  return count;
}

/** 最新记录日晚于「超过 2 个工作日」未更新则视为陈旧（跳过周末）。 */
function isWmpDataLikelyStale(latestIso: string, now: Date = new Date()): boolean {
  const latest = parseLocalDateOnly(latestIso);
  if (!latest) return false;
  return countBusinessDaysAfterLatestToTodayInclusive(latest, now) > 2;
}

function YieldText({ value }: { value: string }) {
  if (value === "N/A") {
    return <span className="text-gray-500">N/A</span>;
  }
  const n = Number.parseFloat(value.replace("%", "").trim());
  if (!Number.isFinite(n)) {
    return <span className="text-gray-500">{value}</span>;
  }
  if (n > 0) return <span className="text-red-400">{value}</span>;
  if (n < 0) return <span className="text-green-400">{value}</span>;
  return <span className="text-gray-500">{value}</span>;
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-slate-800/80 border border-slate-700/80"
        />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 h-40"
        />
      ))}
    </div>
  );
}

export default function WmpPage() {
  const { isMobile } = useIsMobile();
  const [data, setData] = useState<WmpRow[] | null>(null);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wmp", { cache: "no-store" });
      const json = (await res.json()) as ApiPayload;
      setData(json.rows ?? []);
      setLatestDate(json.latestDate ?? json.asOfDate ?? null);
      if (!res.ok) {
        setError(json.error || `请求失败 (${res.status})`);
        return;
      }
      setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData([]);
      setLatestDate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-16">
        <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-center text-sm text-amber-100/90">
          本页面数据仅供参考，不构成任何投资建议
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-sm text-slate-500 transition hover:text-slate-300"
          >
            ← 返回首页
          </Link>
          <h1 className="text-xl font-semibold text-slate-100 md:text-2xl">
            🏦 WMP 净值
          </h1>
          {latestDate && (
            <span className="text-xs text-slate-500">数据截至 {latestDate}</span>
          )}
        </div>

        {loading && (isMobile ? <CardSkeleton /> : <TableSkeleton />)}

        {!loading && error && (!data || data.length === 0) && (
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-6 text-center text-sm text-red-200/90">
            <p className="mb-2">无法读取净值数据</p>
            <p className="text-xs text-red-300/70">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg border border-blue-500/50 bg-slate-900 px-4 py-2 text-sm text-blue-300 hover:bg-slate-800"
            >
              重试
            </button>
          </div>
        )}

        {!loading && data && data.length === 0 && !error && (
          <p className="text-center text-slate-500">
            暂无净值历史数据。请确认服务器上已存在 wmp_history.csv 且由爬虫写入。
          </p>
        )}

        {!loading &&
          data &&
          data.length > 0 &&
          latestDate &&
          isWmpDataLikelyStale(latestDate) && (
            <div
              className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200"
              role="status"
            >
              {`⚠️ 数据可能未更新，最新记录为 ${latestDate}，请注意核实`}
            </div>
          )}

        {!loading && data && data.length > 0 && !isMobile && (
          <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-[#0d1b2e]">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/90 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3 font-medium">产品销售代码</th>
                  <th className="px-3 py-3 font-medium">产品名称</th>
                  <th className="px-3 py-3 font-medium">风险评级</th>
                  <th className="px-3 py-3 font-medium">投资期限</th>
                  <th className="px-3 py-3 font-medium text-right">最新净值</th>
                  <th className="px-3 py-3 font-medium text-right">daily%年化</th>
                  <th className="px-3 py-3 font-medium text-right">1W年化</th>
                  <th className="px-3 py-3 font-medium text-right">1M年化</th>
                  <th className="px-3 py-3 font-medium text-right">3M年化</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr
                    key={r.product_code}
                    className="border-b border-slate-800/90 last:border-0 hover:bg-slate-900/40"
                  >
                    <td className="px-3 py-2.5 font-mono text-slate-300">
                      {r.product_code}
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 text-slate-200">
                      {r.product_name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{r.risk_level}</td>
                    <td className="px-3 py-2.5 text-slate-400">{r.term}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                      {r.nav.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <YieldText value={r.daily_yield} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <YieldText value={r.yield_1w} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <YieldText value={r.yield_1m} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <YieldText value={r.yield_3m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data && data.length > 0 && isMobile && (
          <div className="space-y-4">
            {data.map((r) => (
              <div
                key={r.product_code}
                className="rounded-xl border border-slate-700/80 bg-[#0d1b2e] p-4"
              >
                <div className="mb-2 text-xs text-slate-500">
                  {r.product_code}
                </div>
                <h2 className="text-base font-medium text-slate-100 leading-snug">
                  {r.product_name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {r.risk_level} · {r.term}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  最新净值{" "}
                  <span className="tabular-nums font-medium text-slate-100">
                    {r.nav.toFixed(4)}
                  </span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">daily%年化</div>
                    <YieldText value={r.daily_yield} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">1W年化</div>
                    <YieldText value={r.yield_1w} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">1M年化</div>
                    <YieldText value={r.yield_1m} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">3M年化</div>
                    <YieldText value={r.yield_3m} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs leading-relaxed text-slate-500">
          赎回到账：WMP产品T+1到账；142890 T+2到账；汇华CIO系列T+5到账
        </p>
      </div>
    </div>
  );
}
