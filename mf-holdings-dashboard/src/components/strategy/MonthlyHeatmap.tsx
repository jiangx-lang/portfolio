"use client";

import { useMemo } from "react";
import { STRATEGY, pct } from "@/data/publicStrategy";

const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

/** 红涨绿跌（A 股习惯），色深按 |收益| 缩放，10% 封顶 */
function cellStyle(v: number | null): React.CSSProperties {
  if (v == null) return { color: "#3f4a63" };
  const t = Math.min(Math.abs(v) / 0.1, 1);
  const alpha = 0.08 + t * 0.5;
  const shadow = "0 1px 3px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.05)";
  return v >= 0
    ? { backgroundColor: `rgba(232,93,80,${alpha.toFixed(3)})`, color: "#f3d9d4", boxShadow: shadow }
    : { backgroundColor: `rgba(47,191,143,${alpha.toFixed(3)})`, color: "#d2f0e4", boxShadow: shadow };
}

export function MonthlyHeatmap() {
  const monthly = STRATEGY.monthly;
  const years = useMemo(
    () => Object.keys(monthly).sort((a, b) => Number(a) - Number(b)),
    [monthly]
  );

  const annualOf = (y: string): number | null => {
    const row = monthly[y];
    let acc = 1;
    let any = false;
    for (const m of MONTHS) {
      const v = row?.[m];
      if (v != null) {
        acc *= 1 + v;
        any = true;
      }
    }
    return any ? acc - 1 : null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="px-1 py-1 text-left text-[11px] font-medium text-slate-500">
              年 \ 月
            </th>
            {MONTHS.map((m) => (
              <th
                key={m}
                className="px-1 py-1 text-center text-[11px] font-medium text-slate-500"
              >
                {Number(m)}月
              </th>
            ))}
            <th className="px-1 py-1 text-center text-[11px] font-semibold text-slate-400">
              全年
            </th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <th className="num px-1 py-1 text-left text-[11px] font-medium text-slate-400">
                {y}
              </th>
              {MONTHS.map((m) => {
                const v = monthly[y]?.[m] ?? null;
                return (
                  <td
                    key={m}
                    className="num rounded px-1 py-1.5 text-center text-[11px]"
                    style={cellStyle(v)}
                  >
                    {v == null ? "·" : pct(v, 1)}
                  </td>
                );
              })}
              <td
                className="num rounded px-1 py-1.5 text-center text-[11px] font-semibold"
                style={cellStyle(annualOf(y))}
              >
                {pct(annualOf(y), 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">
        现役版本月度收益（费后）。首年自 2012 年 5 月起、末年至数据截止月，非完整年度。
      </p>
    </div>
  );
}
