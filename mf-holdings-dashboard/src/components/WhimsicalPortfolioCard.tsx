"use client";

import { useEffect, useRef, useState } from "react";
import type { PortfolioSlice, WhimsicalPortfolio } from "@/data/whimsicalPortfolios";

const SIZE = 72;
const CX = 36;
const CY = 36;
const R_OUTER = 30;
const R_INNER = R_OUTER * 0.52;

function drawDonut(ctx: CanvasRenderingContext2D, slices: PortfolioSlice[]) {
  let angle = -Math.PI / 2;
  for (const s of slices) {
    const sweep = (s.pct / 100) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    ctx.beginPath();
    ctx.moveTo(CX + R_OUTER * Math.cos(start), CY + R_OUTER * Math.sin(start));
    ctx.arc(CX, CY, R_OUTER, start, angle);
    ctx.lineTo(CX + R_INNER * Math.cos(angle), CY + R_INNER * Math.sin(angle));
    ctx.arc(CX, CY, R_INNER, angle, start, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(17,24,39,0.35)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function scenarioTone(v: string): string {
  if (v.startsWith("+")) return "text-emerald-400";
  if (v.startsWith("-")) return "text-red-400";
  return "text-gray-300";
}

const RISK_BADGE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-teal-50 text-teal-800",
  2: "bg-blue-50 text-blue-800",
  3: "bg-amber-50 text-amber-800",
  4: "bg-orange-50 text-orange-800",
  5: "bg-red-50 text-red-800",
};

function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.598 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface WhimsicalPortfolioCardProps {
  portfolio: WhimsicalPortfolio;
}

export function WhimsicalPortfolioCard({ portfolio }: WhimsicalPortfolioCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { slices, funds, metrics, scenarios, narrative, warnings, riskLevel, riskLabel, name, subtitle } =
    portfolio;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawDonut(ctx, slices);
  }, [slices]);

  const legendShown = slices.slice(0, 4);
  const moreCount = Math.max(0, slices.length - 4);

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
        <canvas ref={canvasRef} className="shrink-0" width={SIZE} height={SIZE} aria-hidden />
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
          {moreCount > 0 ? (
            <div className="text-[11px] font-medium text-gray-500">+{moreCount} 更多</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-700 pt-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
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
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            expanded ? "max-h-[4000px]" : "max-h-0"
          }`}
        >
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
                className="text-[12px] leading-relaxed text-gray-300 [&_strong]:font-semibold [&_strong]:text-gray-100 [&_span.warn]:font-medium [&_span.warn]:text-amber-300"
                dangerouslySetInnerHTML={{ __html: narrative }}
              />
            </div>

            {warnings.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
                  <WarningGlyph className="text-amber-400" />
                  实战警示
                </div>
                <ul className="space-y-2.5">
                  {warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 rounded-md border border-amber-600/70 border-l-[3px] border-l-amber-500 bg-amber-900/30 py-2.5 pl-2.5 pr-2.5"
                    >
                      <WarningGlyph className="mt-0.5 shrink-0 text-amber-400" />
                      <div
                        className="min-w-0 flex-1 text-[12px] leading-relaxed text-amber-100/95 [&_strong]:font-semibold [&_strong]:text-amber-50"
                        dangerouslySetInnerHTML={{ __html: w }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
