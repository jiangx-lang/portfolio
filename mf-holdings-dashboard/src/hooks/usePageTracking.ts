"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** 页面浏览 → POST /api/track → visitor_logs（需服务端 Secret key） */
export function usePageTracking() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const t = window.setTimeout(() => {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathname }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pathname]);
}
