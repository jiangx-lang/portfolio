"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
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

/** 收益率着色：中国惯例红涨绿跌（text-rise / text-fall 令牌） */
function YieldText({ value }: { value: string }) {
  if (value === "N/A") {
    return <span className="num text-slate-500">N/A</span>;
  }
  const n = Number.parseFloat(value.replace("%", "").trim());
  if (!Number.isFinite(n)) {
    return <span className="num text-slate-500">{value}</span>;
  }
  if (n > 0) return <span className="num text-rise">{value}</span>;
  if (n < 0) return <span className="num text-fall">{value}</span>;
  return <span className="num text-flat">{value}</span>;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="skeleton h-12" />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-40" />
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
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-24">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-gold"
        >
          <ArrowLeft size={14} />
          返回首页
        </Link>

        <header className="mb-8 animate-in">
          <span className="eyebrow">WEALTH MANAGEMENT</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">
            理财净值
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            银行理财（WMP）净值与区间年化收益跟踪
            {latestDate && (
              <span className="num text-slate-500"> · 数据截至 {latestDate}</span>
            )}
          </p>
        </header>

        <div className="glass-panel mb-6 px-4 py-3 text-center text-xs text-slate-400">
          本页面数据仅供参考，不构成任何投资建议
        </div>

        {loading && (isMobile ? <CardSkeleton /> : <TableSkeleton />)}

        {!loading && error && (!data || data.length === 0) && (
          <div className="glass-card px-4 py-10 text-center">
            <p className="mb-2 text-sm text-rise">无法读取净值数据</p>
            <p className="text-xs text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-ghost mx-auto mt-5 text-xs"
            >
              重试
            </button>
          </div>
        )}

        {!loading && data && data.length === 0 && !error && (
          <p className="text-center text-sm text-slate-500">
            暂无净值历史数据。请确认服务器上已存在 wmp_history.csv 且由爬虫写入。
          </p>
        )}

        {!loading &&
          data &&
          data.length > 0 &&
          latestDate &&
          isWmpDataLikelyStale(latestDate) && (
            <div
              className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-xs text-gold-light"
              role="status"
            >
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                数据可能未更新，最新记录为{" "}
                <span className="num">{latestDate}</span>
                ，请注意核实
              </span>
            </div>
          )}

        {!loading && data && data.length > 0 && !isMobile && (
          <div className="atlas-table-wrap animate-in">
            <table className="atlas-table min-w-[900px]">
              <thead>
                <tr>
                  <th>产品销售代码</th>
                  <th>产品名称</th>
                  <th>风险评级</th>
                  <th>投资期限</th>
                  <th>
                    <span className="block text-right">最新净值</span>
                  </th>
                  <th>
                    <span className="block text-right">daily%年化</span>
                  </th>
                  <th>
                    <span className="block text-right">1W年化</span>
                  </th>
                  <th>
                    <span className="block text-right">1M年化</span>
                  </th>
                  <th>
                    <span className="block text-right">3M年化</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.product_code}>
                    <td className="num text-slate-300">{r.product_code}</td>
                    <td className="max-w-[240px] text-slate-200">
                      {r.product_name}
                    </td>
                    <td className="text-slate-400">{r.risk_level}</td>
                    <td className="text-slate-400">{r.term}</td>
                    <td className="num text-right text-slate-100">
                      {r.nav.toFixed(4)}
                    </td>
                    <td className="text-right">
                      <YieldText value={r.daily_yield} />
                    </td>
                    <td className="text-right">
                      <YieldText value={r.yield_1w} />
                    </td>
                    <td className="text-right">
                      <YieldText value={r.yield_1m} />
                    </td>
                    <td className="text-right">
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
              <div key={r.product_code} className="glass-card p-4">
                <div className="num mb-1 text-[11px] text-slate-500">
                  {r.product_code}
                </div>
                <h2 className="text-base font-medium leading-snug text-slate-100">
                  {r.product_name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {r.risk_level} · {r.term}
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  最新净值{" "}
                  <span className="num font-medium text-gold-light">
                    {r.nav.toFixed(4)}
                  </span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-sm">
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

        <hr className="hairline-gold mt-10" />
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          赎回到账：WMP产品T+1到账；142890 T+2到账；汇华CIO系列T+5到账
        </p>
      </div>
    </div>
  );
}
