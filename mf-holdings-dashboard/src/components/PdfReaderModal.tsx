"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ExternalLink, FileText, X } from "lucide-react";

type PdfReaderModalProps = {
  url: string;
  title: string;
  date?: string;
  onClose: () => void;
};

export default function PdfReaderModal({ url, title, date, onClose }: PdfReaderModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onClose}
    >
      <motion.div
        className="glass-panel glow-border flex h-[88vh] w-[min(1100px,94vw)] flex-col overflow-hidden rounded-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
            <FileText className="h-4 w-4 text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-slate-100">
              {title}
            </div>
            {date && <div className="mt-0.5 font-mono text-xs text-slate-500">{date}</div>}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost shrink-0 !px-3 !py-2 text-xs"
          >
            新窗口打开
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭阅读器"
            className="btn-ghost shrink-0 !p-2.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe
          src={url}
          title={title}
          className="w-full flex-1 rounded-b-2xl bg-white"
        />
      </motion.div>
    </motion.div>
  );
}
