"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AnalyticsBeacon() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const t = window.setTimeout(() => {
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "page", page_path: pathname }),
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
