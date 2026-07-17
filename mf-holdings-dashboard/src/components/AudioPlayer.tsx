"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Loader2, Pause, Play } from "lucide-react";

/**
 * ATLAS 统一音频播放器：自研 UI，audio 元素仅作播放引擎。
 * - 全站同时只允许一个实例播放（window 自定义事件 atlas:audio-play）
 * - 断点续播：localStorage key atlas_audio_pos:<id>，timeupdate 节流 ~3s 保存
 */

const RATES = [1, 1.25, 1.5, 2];
const PLAY_EVENT = "atlas:audio-play";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AudioPlayer({
  id,
  src,
  downloadUrl,
  onPlay,
}: {
  id: number;
  src: string;
  downloadUrl?: string;
  onPlay?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const lastSaveRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(NaN);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);
  const [error, setError] = useState(false);

  const posKey = `atlas_audio_pos:${id}`;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const savePos = () => {
      if (a.currentTime <= 0) return;
      try {
        window.localStorage.setItem(posKey, String(a.currentTime));
      } catch {
        // localStorage 不可用时静默
      }
    };
    const clearPos = () => {
      try {
        window.localStorage.removeItem(posKey);
      } catch {
        // 同上
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(a.duration);
      // 断点续播：进度 >5s 且未播完才恢复
      let saved = 0;
      try {
        saved = Number(window.localStorage.getItem(posKey) || 0);
      } catch {
        saved = 0;
      }
      if (
        Number.isFinite(saved) &&
        saved > 5 &&
        Number.isFinite(a.duration) &&
        saved < a.duration - 5
      ) {
        a.currentTime = saved;
        setCurrentTime(saved);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(a.currentTime);
      const now = Date.now();
      if (now - lastSaveRef.current >= 3000) {
        lastSaveRef.current = now;
        savePos();
      }
    };
    const handlePlay = () => {
      setPlaying(true);
      setLoading(false);
      // 通知其他实例暂停，保证同时只有一个在播
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: { id } }));
      onPlayRef.current?.();
    };
    const handlePlaying = () => setLoading(false);
    const handleCanPlay = () => setLoading(false);
    const handlePause = () => {
      setPlaying(false);
      setLoading(false);
      savePos();
    };
    const handleWaiting = () => setLoading(true);
    const handleSeeked = () => setLoading(false);
    const handleEnded = () => {
      setPlaying(false);
      setLoading(false);
      clearPos();
    };
    const handleError = () => {
      setError(true);
      setPlaying(false);
      setLoading(false);
    };
    const handleOtherPlay = (e: Event) => {
      const detail = (e as CustomEvent<{ id: number }>).detail;
      if (detail?.id !== id && !a.paused) a.pause();
    };

    a.addEventListener("loadedmetadata", handleLoadedMetadata);
    a.addEventListener("timeupdate", handleTimeUpdate);
    a.addEventListener("play", handlePlay);
    a.addEventListener("playing", handlePlaying);
    a.addEventListener("canplay", handleCanPlay);
    a.addEventListener("pause", handlePause);
    a.addEventListener("waiting", handleWaiting);
    a.addEventListener("seeked", handleSeeked);
    a.addEventListener("ended", handleEnded);
    a.addEventListener("error", handleError);
    window.addEventListener(PLAY_EVENT, handleOtherPlay);

    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", handleLoadedMetadata);
      a.removeEventListener("timeupdate", handleTimeUpdate);
      a.removeEventListener("play", handlePlay);
      a.removeEventListener("playing", handlePlaying);
      a.removeEventListener("canplay", handleCanPlay);
      a.removeEventListener("pause", handlePause);
      a.removeEventListener("waiting", handleWaiting);
      a.removeEventListener("seeked", handleSeeked);
      a.removeEventListener("ended", handleEnded);
      a.removeEventListener("error", handleError);
      window.removeEventListener(PLAY_EVENT, handleOtherPlay);
    };
  }, [id, posKey]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || error) return;
    if (a.paused) {
      setLoading(true);
      void a.play().catch(() => {
        setPlaying(false);
        setLoading(false);
      });
    } else {
      a.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || error || loading) return;
    if (!Number.isFinite(a.duration) || a.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setCurrentTime(a.currentTime);
  };

  const cycleRate = () => {
    const a = audioRef.current;
    const next = (rateIdx + 1) % RATES.length;
    setRateIdx(next);
    if (a) a.playbackRate = RATES[next] ?? 1;
  };

  const pct =
    Number.isFinite(duration) && duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : 0;

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 sm:gap-3">
      <button
        type="button"
        onClick={togglePlay}
        disabled={error}
        aria-label={playing ? "暂停" : "播放"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-navy transition hover:shadow-glow-gold disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {error ? (
          <p className="text-rise text-xs">音频加载失败</p>
        ) : (
          <div
            onClick={handleSeek}
            role="presentation"
            className={
              loading
                ? "group flex h-4 cursor-not-allowed items-center"
                : "group flex h-4 cursor-pointer items-center"
            }
          >
            <div className="relative h-1.5 w-full rounded-full bg-white/[0.08] transition-all group-hover:h-2">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-gold"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <span className="shrink-0 font-mono text-xs text-slate-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <button
        type="button"
        onClick={cycleRate}
        aria-label="切换倍速"
        className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-slate-400 transition hover:border-gold/40 hover:text-gold-light"
      >
        {RATES[rateIdx]}x
      </button>

      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          aria-label="下载音频"
          className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          下载
        </a>
      )}

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
