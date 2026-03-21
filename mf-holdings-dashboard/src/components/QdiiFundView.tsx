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
      <div className="rounded-xl border border-white/10 bg-navy-card p-6">
        <p className="text-sm text-white/60">
          {code} · ISIN {isin} · {ccy}
        </p>
        <p className="mt-2 text-3xl font-mono font-semibold text-white">
          {latestNav.toFixed(4)}
        </p>
        <p className={ytd >= 0 ? "text-gain" : "text-loss"}>
          YTD {ytd >= 0 ? "+" : ""}{ytd.toFixed(2)}%
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">历史净值曲线</h2>
        <NavChart dates={dates} navs={navs} isin={isin} />
      </section>

      <p className="text-sm text-white/50">
        本页为 QDII 基金净值与公开披露数据；标的级波动类数据请在对应标的详情页查看。
      </p>

      <QdAISignalBox code={code} />
    </div>
  );
}
