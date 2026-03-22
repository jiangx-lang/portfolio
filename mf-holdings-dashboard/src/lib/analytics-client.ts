export type AnalyticsPayload = {
  event_type: "page" | "content";
  page_path?: string;
  content_type?: "market_note" | "podcast" | "daily_report";
  content_id?: number;
};

export function trackAnalytics(payload: AnalyticsPayload): void {
  if (typeof window === "undefined") return;
  const page_path = payload.page_path ?? window.location.pathname;
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, page_path }),
  }).catch(() => {});
}
