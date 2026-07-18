export type ChroniclePanel = {
  id: string;
  chapter?: string;
  title: string;
  question?: string;
  panel?: string;
  dataset: string;
  highlight?: string;
  category?: string;
  static_url?: string;
};

export type ChronicleCategory =
  | "sp500"
  | "nasdaq"
  | "semi"
  | "xlk"
  | "fin"
  | "mag7"
  | "dynasties"
  | "latest"
  | "macro"
  | "other";

export const CATEGORY_META: Record<
  ChronicleCategory,
  { label: string; labelEn: string; order: number }
> = {
  sp500: { label: "标普 500", labelEn: "S&P 500", order: 1 },
  nasdaq: { label: "纳斯达克", labelEn: "Nasdaq", order: 2 },
  semi: { label: "半导体", labelEn: "Semiconductors", order: 3 },
  xlk: { label: "信息技术 XLK", labelEn: "XLK", order: 4 },
  fin: { label: "金融 XLF", labelEn: "Financials", order: 5 },
  mag7: { label: "七巨头", labelEn: "Magnificent 7", order: 6 },
  dynasties: { label: "市值王朝", labelEn: "Dynasties", order: 7 },
  latest: { label: "集中度与回撤", labelEn: "Concentration", order: 8 },
  macro: { label: "宏观", labelEn: "Macro", order: 9 },
  other: { label: "其他", labelEn: "Other", order: 10 },
};

export function inferCategory(panel: ChroniclePanel): ChronicleCategory {
  const c = (panel.category || "").toLowerCase();
  if (c in CATEGORY_META) return c as ChronicleCategory;
  const id = panel.id.toLowerCase();
  const ds = panel.dataset.toLowerCase();
  if (id.startsWith("ndx") || id.startsWith("nasdaq") || ds.includes("/ndx/") || ds.includes("/nasdaq/"))
    return "nasdaq";
  if (id.startsWith("semi") || ds.includes("/semi/")) return "semi";
  if (id.startsWith("xlk") || ds.includes("/xlk/")) return "xlk";
  if (id.startsWith("fin") || ds.includes("/fin/")) return "fin";
  if (id.startsWith("mag7") || id.startsWith("m7") || ds.includes("/mag7/") || ds.includes("/m7/"))
    return "mag7";
  if (id.startsWith("top10") || c === "dynasties" || ds.includes("/dynast")) return "dynasties";
  if (id.startsWith("cp-") || ds.includes("/latest/")) return "latest";
  if (id.includes("aiae") || id.includes("yield") || ds.includes("recessions") || ds.includes("yield-curve"))
    return "macro";
  if (id.startsWith("sp500") || ds.includes("/sp500/") || c === "sp500") return "sp500";
  return "other";
}

export function datasetPathFromUrl(datasetUrl: string): string {
  try {
    const u = new URL(datasetUrl);
    return u.pathname.replace(/^\/api\//, "");
  } catch {
    return datasetUrl.replace(/^https?:\/\/[^/]+\/api\//, "").replace(/^\//, "");
  }
}
