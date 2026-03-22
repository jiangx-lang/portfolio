import fs from "fs";
import path from "path";

const LONG_PREFIX = /^crisis_report_long/i;
const LONG_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function getCrisisMonitorDir(): string {
  return (
    process.env.CRISIS_MONITOR_OUT_DIR ||
    "/root/fredmonitor/outputs/crisis_monitor"
  );
}

export function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

/** 从 crisis_report_long_YYYYMMDD_HHMMSS 解析展示标签 */
export function labelForLongFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const m = base.match(
    /^crisis_report_long_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/i
  );
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}（文件时间戳）`;
  }
  return base;
}

function safeResolvedUnderDir(dir: string, basenameOnly: string): string | null {
  const root = path.resolve(dir);
  const full = path.resolve(path.join(dir, basenameOnly));
  if (!full.startsWith(root + path.sep) && full !== root) {
    return null;
  }
  return full;
}

export function isValidLongBasename(name: string): boolean {
  if (!name || name !== path.basename(name)) return false;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  if (!LONG_PREFIX.test(name)) return false;
  return LONG_EXTS.has(path.extname(name).toLowerCase());
}

export type LongReportMeta = {
  name: string;
  mtimeMs: number;
  label: string;
  /** 从文件名 crisis_report_long_YYYYMMDD_HHMMSS 解析出的时间戳 ms，无则 null */
  fileTimeMs: number | null;
};

/** 从文件名解析「报告生成时刻」（比 mtime 可靠：SCP 常把 mtime 改成上传时间） */
export function parseFileTimeMsFromLongName(filename: string): number | null {
  const base = path.basename(filename, path.extname(filename));
  const m = base.match(
    /^crisis_report_long_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/i
  );
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const t = Date.UTC(y, mo, d, h, mi, s);
  return Number.isFinite(t) ? t : null;
}

function sortKeyNewestFirst(r: LongReportMeta): number {
  if (r.fileTimeMs != null) return r.fileTimeMs;
  return r.mtimeMs;
}

/** 按「文件名内时间戳」优先，否则按 mtime，新→旧 */
export function listLongReportsSorted(): LongReportMeta[] {
  const dir = getCrisisMonitorDir();
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const candidates = names.filter((n) => {
    if (!LONG_PREFIX.test(n)) return false;
    return LONG_EXTS.has(path.extname(n).toLowerCase());
  });
  const rows: LongReportMeta[] = [];
  for (const name of candidates) {
    const full = safeResolvedUnderDir(dir, name);
    if (!full) continue;
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      rows.push({
        name,
        mtimeMs: st.mtimeMs,
        label: labelForLongFilename(name),
        fileTimeMs: parseFileTimeMsFromLongName(name),
      });
    } catch {
      continue;
    }
  }
  rows.sort((a, b) => sortKeyNewestFirst(b) - sortKeyNewestFirst(a));
  return rows;
}

export function readLongReportBytes(
  basename: string | null | undefined
): { buf: Buffer; chosen: string } | null {
  const dir = getCrisisMonitorDir();
  try {
    if (basename && isValidLongBasename(basename)) {
      const full = safeResolvedUnderDir(dir, basename);
      if (!full) return null;
      const buf = fs.readFileSync(full);
      return { buf, chosen: basename };
    }
    const sorted = listLongReportsSorted();
    if (sorted.length === 0) return null;
    const chosen = sorted[0].name;
    const full = safeResolvedUnderDir(dir, chosen);
    if (!full) return null;
    const buf = fs.readFileSync(full);
    return { buf, chosen };
  } catch {
    return null;
  }
}
