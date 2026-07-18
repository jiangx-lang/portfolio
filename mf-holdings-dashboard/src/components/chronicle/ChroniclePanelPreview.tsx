"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ChronicleChart } from "@/components/chronicle/ChronicleChart";
import { panelShortTitle } from "@/lib/chronicle/magazine";
import {
  isChronicleJsonDataset,
  resolveDatasetRel,
  type ChroniclePanel,
} from "@/lib/chronicle/types";
import { PANEL_ZH } from "@/lib/chronicle/zh";

function EditorialNoApi({ panel, height }: { panel: ChroniclePanel; height: number }) {
  const href = panel.static_url || panel.panel || panel.dataset;
  const q = PANEL_ZH[panel.id]?.q;
  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-dashed border-gold/25 bg-gold/[0.04] px-4 py-4"
      style={{ minHeight: height }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
          原站专页 · JSON 未公开
        </div>
        <div className="mt-2 font-display text-lg text-gold-light">{panelShortTitle(panel)}</div>
        {q ? (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-3">{q}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">{panel.title}</p>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-light"
        onClick={(e) => e.stopPropagation()}
      >
        在 History of Market 打开 <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/**
 * 视口内才拉数据的旗舰预览图 —— Hub 杂志布局核心，避免一次加载全部面板。
 */
export function ChroniclePanelPreview({
  panel,
  height = 300,
}: {
  panel: ChroniclePanel;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasJson = isChronicleJsonDataset(panel);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !hasJson) return;
    let cancelled = false;
    const rel = resolveDatasetRel(panel);
    if (!rel || rel === "/" || !rel.includes(".")) {
      setErr("no-json");
      return;
    }
    setLoading(true);
    setErr(null);
    fetch(`/api/chronicle/${rel}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, panel, hasJson]);

  return (
    <div ref={ref} className="w-full" style={{ minHeight: height }}>
      {!hasJson ? (
        <EditorialNoApi panel={panel} height={height} />
      ) : err ? (
        <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-slate-500">
          图表暂不可用
        </div>
      ) : loading || !data ? (
        <div className="skeleton w-full rounded-xl" style={{ height }} aria-hidden />
      ) : (
        <div style={{ height }} className="w-full overflow-hidden">
          <ChronicleChart data={data} title="" compact height={height} panelId={panel.id} />
        </div>
      )}
    </div>
  );
}
