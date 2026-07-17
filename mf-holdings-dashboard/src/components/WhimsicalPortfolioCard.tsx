"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { PortfolioSlice, WhimsicalPortfolio } from "@/data/whimsicalPortfolios";

const SIZE = 72;
const CX = 36;
const CY = 36;
const R_OUTER = 30;
const R_INNER = R_OUTER * 0.52;

/**
 * ATLAS 令牌色盘（金 / 蓝 / 石板）。
 * canvas 无法读取 CSS 变量，此处镜像 DESIGN_SYSTEM 令牌值，按切片序号循环取色。
 */
const SLICE_PALETTE = [
  "#C9A84C", // gold
  "#5B93F0", // info
  "#94A3B8", // slate-400
  "#9A7E2F", // gold-dark
  "#2F66C4", // primary
  "#64748B", // slate-500
];

function sliceColor(i: number): string {
  return SLICE_PALETTE[i % SLICE_PALETTE.length];
}

function drawDonut(ctx: CanvasRenderingContext2D, slices: PortfolioSlice[]) {
  let angle = -Math.PI / 2;
  slices.forEach((s, i) => {
    const sweep = (s.pct / 100) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    ctx.beginPath();
    ctx.moveTo(CX + R_OUTER * Math.cos(start), CY + R_OUTER * Math.sin(start));
    ctx.arc(CX, CY, R_OUTER, start, angle);
    ctx.lineTo(CX + R_INNER * Math.cos(angle), CY + R_INNER * Math.sin(angle));
    ctx.arc(CX, CY, R_INNER, angle, start, true);
    ctx.closePath();
    ctx.fillStyle = sliceColor(i);
    ctx.fill();
    ctx.strokeStyle = "rgba(5,7,13,0.5)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });
}

function scenarioTone(v: string): string {
  if (v.startsWith("+")) return "text-rise";
  if (v.startsWith("-")) return "text-fall";
  return "text-flat";
}

const RISK_BADGE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "badge badge-green",
  2: "badge badge-blue",
  3: "badge badge-gold",
  4: "badge badge-red",
  5: "badge badge-red",
};

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
    <div className="glass-card flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={RISK_BADGE[riskLevel]}>{riskLabel}</span>
      </div>
      <h3 className="text-base font-bold leading-snug text-slate-50">{name}</h3>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>

      <div className="mt-4 flex gap-3">
        <canvas ref={canvasRef} className="shrink-0" width={SIZE} height={SIZE} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          {legendShown.map((sl, i) => (
            <div key={sl.label} className="flex items-center gap-2 text-[11px] leading-tight text-slate-300">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: sliceColor(i) }}
                aria-hidden
              />
              <span className="truncate">{sl.label}</span>
              <span className="num ml-auto shrink-0 text-slate-500">{sl.pct}%</span>
            </div>
          ))}
          {moreCount > 0 ? (
            <div className="text-[11px] font-medium text-slate-500">+{moreCount} 更多</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.07] pt-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-slate-400 transition-colors hover:text-slate-200"
        >
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              预期收益 <strong className="num font-semibold text-slate-200">{metrics.ret}</strong>
            </span>
            <span>
              波动率 <strong className="num font-semibold text-slate-200">{metrics.vol}</strong>
            </span>
            <span>
              最大回撤 <strong className="num font-semibold text-slate-200">{metrics.maxDD}</strong>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-slate-500">
            {expanded ? "收起" : "展开"}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>

        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            expanded ? "max-h-[4000px]" : "max-h-0"
          }`}
        >
          <div className="space-y-4 pt-4">
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                基金配置明细
              </div>
              <ul className="space-y-2.5">
                {funds.map((f, i) => (
                  <li key={f.name}>
                    <div className="mb-1 flex justify-between gap-2 text-[11px] text-slate-300">
                      <span className="min-w-0 flex-1 leading-snug">{f.name}</span>
                      <span className="num shrink-0 text-slate-400">{f.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-navy">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${f.pct}%`, backgroundColor: sliceColor(i) }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                情景压力测试
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="rounded-lg bg-navy-card/70 px-2 py-2">
                  <div className="mb-1 text-slate-500">基准</div>
                  <div className={`num font-semibold ${scenarioTone(scenarios.base)}`}>
                    {scenarios.base}
                  </div>
                </div>
                <div className="rounded-lg bg-navy-card/70 px-2 py-2">
                  <div className="mb-1 text-slate-500">通胀地缘</div>
                  <div className={`num font-semibold ${scenarioTone(scenarios.inflationGeo)}`}>
                    {scenarios.inflationGeo}
                  </div>
                </div>
                <div className="rounded-lg bg-navy-card/70 px-2 py-2">
                  <div className="mb-1 text-slate-500">AI衰退</div>
                  <div className={`num font-semibold ${scenarioTone(scenarios.aiRecession)}`}>
                    {scenarios.aiRecession}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                配置逻辑
              </div>
              <div
                className="text-[12px] leading-relaxed text-slate-300 [&_strong]:font-semibold [&_strong]:text-slate-100 [&_span.warn]:font-medium [&_span.warn]:text-gold-light"
                dangerouslySetInnerHTML={{ __html: narrative }}
              />
            </div>

            {warnings.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gold-light">
                  <AlertTriangle className="h-3.5 w-3.5 text-gold" aria-hidden />
                  实战警示
                </div>
                <ul className="space-y-2.5">
                  {warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 rounded-md border border-[rgba(201,168,76,0.35)] border-l-[3px] border-l-gold bg-[rgba(201,168,76,0.08)] py-2.5 pl-2.5 pr-2.5"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
                      <div
                        className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-200 [&_strong]:font-semibold [&_strong]:text-gold-light"
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
