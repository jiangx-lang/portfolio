/**
 * WMP 展示表逻辑，与仓库根目录 wmp_db.get_wmp_display_data() 对齐。
 */

export type WmpApiRow = {
  product_code: string;
  product_name: string;
  risk_level: string;
  term: string;
  nav: number;
  daily_yield: string;
  yield_1w: string;
  yield_1m: string;
  yield_3m: string;
};

type RawRow = {
  date: string;
  product_code: string;
  product_name: string;
  risk_level: string;
  term: string;
  nav: number;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseWmpCsvRows(csvText: string): RawRow[] {
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const lines = text.split(/\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const iDate = col("date");
  const iCode = col("product_code");
  const iName = col("product_name");
  const iRisk = col("risk_level");
  const iTerm = col("term");
  const iNav = col("nav");

  if (iDate < 0 || iCode < 0 || iName < 0 || iRisk < 0 || iTerm < 0 || iNav < 0) {
    return [];
  }

  const byKey = new Map<string, RawRow>();

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols.length < header.length) continue;
    const date = String(cols[iDate] ?? "").trim();
    const product_code = String(cols[iCode] ?? "").trim();
    if (!date || !product_code) continue;
    const nav = Number.parseFloat(String(cols[iNav] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(nav) || nav <= 0) continue;
    const key = `${date}\t${product_code}`;
    byKey.set(key, {
      date,
      product_code,
      product_name: String(cols[iName] ?? "").trim(),
      risk_level: String(cols[iRisk] ?? "").trim(),
      term: String(cols[iTerm] ?? "").trim(),
      nav,
    });
  }

  return Array.from(byKey.values());
}

function navOnOrBefore(rows: RawRow[], code: string, targetDate: string): number | null {
  const candidates = rows.filter((r) => r.product_code === code && r.date <= targetDate);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  const n = candidates[0]!.nav;
  if (n <= 0) return null;
  return n;
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function annualizedDaily(n0: number, n1: number | null): string {
  if (n1 == null || n1 <= 0) return "N/A";
  const pct = (n0 / n1 - 1) * 365;
  return `${pct.toFixed(2)}%`;
}

function annualized1w(n0: number, n7: number | null): string {
  if (n7 == null || n7 <= 0) return "N/A";
  const pct = (n0 / n7 - 1) * (365 / 7);
  return `${pct.toFixed(2)}%`;
}

function annualized1m(n0: number, n30: number | null): string {
  if (n30 == null || n30 <= 0) return "N/A";
  const pct = (n0 / n30 - 1) * (365 / 30);
  return `${pct.toFixed(2)}%`;
}

function annualized3m(n0: number, n90: number | null): string {
  if (n90 == null || n90 <= 0) return "N/A";
  const pct = (n0 / n90 - 1) * (365 / 90);
  return `${pct.toFixed(2)}%`;
}

function parse1wSort(val: string): number {
  if (val === "N/A") return Number.NEGATIVE_INFINITY;
  const n = Number.parseFloat(val.replace("%", "").trim());
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

/**
 * 从 CSV 全文生成与 Streamlit 一致的展示行（已按 1W 年化降序，N/A 最后）。
 */
export function computeWmpDisplayFromCsvText(csvText: string): {
  rows: WmpApiRow[];
  asOfDate: string | null;
} {
  const dfAll = parseWmpCsvRows(csvText);
  if (dfAll.length === 0) {
    return { rows: [], asOfDate: null };
  }

  const datesAsc = Array.from(new Set(dfAll.map((r) => r.date))).sort();
  const t0Date = datesAsc[datesAsc.length - 1]!;

  const target1 = addDaysIso(t0Date, -1);
  const target7 = addDaysIso(t0Date, -7);
  const target30 = addDaysIso(t0Date, -30);
  const target90 = addDaysIso(t0Date, -90);

  const codesOnOrBefore = new Set(
    dfAll.filter((r) => r.date <= t0Date).map((r) => r.product_code)
  );

  const rowsOut: WmpApiRow[] = [];

  for (const code of Array.from(codesOnOrBefore)) {
    const productRows = dfAll.filter((r) => r.product_code === code);
    const candidates = productRows.filter((r) => r.date <= t0Date);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.date.localeCompare(a.date));
    const lastRow = candidates[0]!;
    const navT0 = lastRow.nav;

    const nav1 = navOnOrBefore(dfAll, code, target1);
    const nav7 = navOnOrBefore(dfAll, code, target7);
    const nav30 = navOnOrBefore(dfAll, code, target30);
    const nav90 = navOnOrBefore(dfAll, code, target90);

    rowsOut.push({
      product_code: code,
      product_name: lastRow.product_name,
      risk_level: lastRow.risk_level,
      term: lastRow.term,
      nav: navT0,
      daily_yield: annualizedDaily(navT0, nav1),
      yield_1w: annualized1w(navT0, nav7),
      yield_1m: annualized1m(navT0, nav30),
      yield_3m: annualized3m(navT0, nav90),
    });
  }

  rowsOut.sort((a, b) => parse1wSort(b.yield_1w) - parse1wSort(a.yield_1w));

  return { rows: rowsOut, asOfDate: t0Date };
}
