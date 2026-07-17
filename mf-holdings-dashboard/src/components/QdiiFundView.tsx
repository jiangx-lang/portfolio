"use client";

import { NavChart } from "./NavChart";
import { QdAISignalBox } from "./QdAISignalBox";

interface QdiiFundViewProps {
  code: string;
  isin: string;
  ccy: string;
  latestNav: number;
  ytd: number;
  dates: string[];
  navs: number[];
}

export function QdiiFundView({
  code,
  isin,
  ccy,
  latestNav,
  ytd,
  dates,
  navs,
}: QdiiFundViewProps) {
  return (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <p className="font-mono text-xs tracking-wide text-slate-500">
          {code} · ISIN {isin} · {ccy}
        </p>
        <p className="num mt-3 text-3xl font-semibold text-slate-50">
          {latestNav.toFixed(4)}
        </p>
        <p
          className={`mt-2 font-mono text-sm font-medium ${
            ytd > 0 ? "text-rise" : ytd < 0 ? "text-fall" : "text-flat"
          }`}
        >
          YTD {ytd > 0 ? "+" : ""}{ytd.toFixed(2)}%
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-100">历史净值曲线</h2>
        <NavChart dates={dates} navs={navs} isin={isin} />
      </section>

      <p className="text-sm text-slate-500">
        本页为 QDII 基金净值与公开披露数据；标的级波动类数据请在对应标的详情页查看。
      </p>

      <QdAISignalBox code={code} />
    </div>
  );
}
