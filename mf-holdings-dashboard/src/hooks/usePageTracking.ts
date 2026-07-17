"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 页面浏览打点 + 进度 XP 奖励。
 * 同时写入 visitor_logs 与 user_activity。
 */
export function usePageTracking() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/unlock")) {
      return;
    }

    const t = window.setTimeout(() => {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathname }),
      }).catch(() => {});

      void fetch("/api/progress/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "page_view", page_path: pathname }),
      }).catch(() => {});
    }, 600);

    return () => window.clearTimeout(t);
  }, [pathname]);
}
