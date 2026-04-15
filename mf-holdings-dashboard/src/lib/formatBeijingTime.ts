export function formatBeijingTime(utcString: string): string {
  if (!utcString) return "—";
  const d = new Date(utcString);
  if (Number.isNaN(d.getTime())) return "—";

  // 手动加 8 小时，避免 toLocaleString 在不同运行时不一致
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);

  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bj.getUTCDate()).padStart(2, "0");
  const hh = String(bj.getUTCHours()).padStart(2, "0");
  const mm = String(bj.getUTCMinutes()).padStart(2, "0");
  const ss = String(bj.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

