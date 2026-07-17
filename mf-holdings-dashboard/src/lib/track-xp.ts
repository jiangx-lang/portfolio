"use client";

/**
 * 内容阅读 XP 奖励（content_read，+10 XP）。
 * 同一内容每会话只奖励一次（sessionStorage 去重），调用失败静默。
 */
export function awardContentRead(
  kind: "market_note" | "daily_report" | "podcast",
  id: number,
  pagePath: string = "/notes"
) {
  if (typeof window === "undefined") return;

  const key = `atlas_xp_read:${kind}:${id}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage 不可用时仍尝试发放
  }

  void fetch("/api/progress/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "content_read",
      page_path: pagePath,
      content_type: kind,
    }),
  }).catch(() => {});
}
