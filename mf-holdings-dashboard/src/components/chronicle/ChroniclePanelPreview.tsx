"use client";

import { useEffect, useRef, useState } from "react";
import { ChronicleChart } from "@/components/chronicle/ChronicleChart";
import { datasetPathFromUrl, type ChroniclePanel } from "@/lib/chronicle/types";

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
    if (!visible) return;
    let cancelled = false;
    const rel = datasetPathFromUrl(panel.dataset);
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
  }, [visible, panel.dataset]);

  return (
    <div ref={ref} className="w-full" style={{ minHeight: height }}>
      {err ? (
        <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-slate-500">
          图表暂不可用
        </div>
      ) : loading || !data ? (
        <div
          className="skeleton w-full rounded-xl"
          style={{ height }}
          aria-hidden
        />
      ) : (
        <div style={{ height }} className="w-full">
          <ChronicleChart data={data} title="" compact height={height} />
        </div>
      )}
    </div>
  );
}
