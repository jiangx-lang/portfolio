"use client";

import type { WhimsicalPortfolio } from "@/data/whimsicalPortfolios";

const R_OUTER = 30;
const R_INNER = R_OUTER * 0.52;
const CX = 36;
const CY = 36;

function donutSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const xos = cx + rOuter * Math.cos(startAngle);
  const yos = cy + rOuter * Math.sin(startAngle);
  const xoe = cx + rOuter * Math.cos(endAngle);
  const yoe = cy + rOuter * Math.sin(endAngle);
  const xis = cx + rInner * Math.cos(endAngle);
  const yis = cy + rInner * Math.sin(endAngle);
  const xie = cx + rInner * Math.cos(startAngle);
  const yie = cy + rInner * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${xos} ${yos}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xoe} ${yoe}`,
    `L ${xis} ${yis}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xie} ${yie}`,
    "Z",
  ].join(" ");
}

function scenarioTone(v: string): string {
  return v.startsWith("+") ? "text-emerald-400" : "text-red-400";
}

const RISK_BADGE: Record<
  1 | 2 | 3 | 4 | 5,
  string
> = {
  1: "bg-teal-50 text-teal-800",
  2: "bg-blue-50 text-blue-800",
  3: "bg-amber-50 text-amber-800",
  4: "bg-orange-50 text-orange-800",
  5: "bg-red-50 text-red-800",
};

export interface WhimsicalPortfolioCardProps {
  portfolio: WhimsicalPortfolio;
  expanded: boolean;
  onToggle: () => void;
}

export function WhimsicalPortfolioCard({ portfolio, expanded, onToggle }: WhimsicalPortfolioCardProps) {
  const { slices, funds, metrics, scenarios, narrative, riskLevel, riskLabel, name, subtitle } = portfolio;

  let angle = -Math.PI / 2;
  const paths = slices.map((s) => {
    const sweep = (s.pct / 100) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return {
      d: donutSegmentPath(CX, CY, R_OUTER, R_INNER, start, angle),
      color: s.color,
      key: `${s.label}-${s.pct}`,
    };
  });

  const legendShown = slices.slice(0, 4);
  const legendMore = slices.length > 4;

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${RISK_BADGE[riskLevel]}`}
        >
          {riskLabel}
        </span>
      </div>
      <h3 className="text-base font-bold leading-snug text-gray-50">{name}</h3>
      <p className="mt-1 text-xs text-gray-400">{subtitle}</p>

      <div className="mt-4 flex gap-3">
        <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0" aria-hidden>
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} stroke="rgba(17,24,39,0.35)" strokeWidth={0.5} />
          ))}
        </svg>
        <div className="min-w-0 flex-1 space-y-1.5">
          {legendShown.map((sl) => (
            <div key={sl.label} className="flex items-center gap-2 text-[11px] leading-tight text-gray-300">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: sl.color }}
                aria-hidden
              />
              <span className="truncate">{sl.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-gray-500">{sl.pct}%</span>
            </div>
          ))}
          {legendMore ? (
            <div className="text-[11px] font-medium text-gray-500">…</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-700 pt-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-gray-400 transition-colors hover:text-gray-200"
        >
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              预期收益 <strong className="font-semibold text-gray-200">{metrics.ret}</strong>
            </span>
            <span>
              波动率 <strong className="font-semibold text-gray-200">{metrics.vol}</strong>
            </span>
            <span>
              最大回撤 <strong className="font-semibold text-gray-200">{metrics.maxDD}</strong>
            </span>
          </span>
          <span className="shrink-0 text-gray-500">{expanded ? "收起 ▴" : "展开 ▾"}</span>
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 pt-4">
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  基金配置明细
                </div>
                <ul className="space-y-2.5">
                  {funds.map((f) => (
                    <li key={f.name}>
                      <div className="mb-1 flex justify-between gap-2 text-[11px] text-gray-300">
                        <span className="min-w-0 flex-1 leading-snug">{f.name}</span>
                        <span className="shrink-0 tabular-nums text-gray-400">{f.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-700/80">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${f.pct}%`, backgroundColor: f.color }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  情景压力测试
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="rounded-lg bg-gray-900/50 px-2 py-2">
                    <div className="mb-1 text-gray-500">基准</div>
                    <div className={`font-semibold tabular-nums ${scenarioTone(scenarios.base)}`}>
                      {scenarios.base}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-900/50 px-2 py-2">
                    <div className="mb-1 text-gray-500">通胀地缘</div>
                    <div className={`font-semibold tabular-nums ${scenarioTone(scenarios.inflationGeo)}`}>
                      {scenarios.inflationGeo}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-900/50 px-2 py-2">
                    <div className="mb-1 text-gray-500">AI衰退</div>
                    <div className={`font-semibold tabular-nums ${scenarioTone(scenarios.aiRecession)}`}>
                      {scenarios.aiRecession}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  配置逻辑
                </div>
                <div
                  className="text-[12px] leading-relaxed text-gray-300 [&_strong]:font-semibold [&_strong]:text-gray-100"
                  dangerouslySetInnerHTML={{ __html: narrative }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
