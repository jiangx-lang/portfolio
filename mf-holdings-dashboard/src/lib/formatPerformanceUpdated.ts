/** 绩效数据「更新时间」展示（中国本地时区可读格式） */
export function formatPerformanceLastUpdated(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}
