import type { ChronicleCategory, ChroniclePanel } from "./types";
import { CATEGORY_META, inferCategory } from "./types";

/** 类目罗马数字（对齐 History of Market 章节轨） */
export const SECTION_ROMAN: Record<ChronicleCategory, string> = {
  sp500: "I",
  nasdaq: "II",
  semi: "III",
  xlk: "IV",
  fin: "V",
  mag7: "VI",
  dynasties: "VII",
  latest: "VIII",
  macro: "IX",
  other: "X",
};

/** 每章优先展示的旗舰面板（图为主） */
export const FLAGSHIP_IDS = new Set([
  "annual",
  "sp500-logyoy",
  "pe",
  "forward-pe",
  "drawdown",
  "m7",
  "nasdaq-composite",
  "nasdaq-logyoy",
  "ndx-drawdown",
  "ndx-forward-pe",
  "semi-price",
  "semi-annual",
  "xlk-price",
  "fin-price",
  "fin-crisis",
  "mag7-concentration",
  "mag7-index",
  "top10-roster",
  "cp-conc-top10",
  "cp-dd-base-rates",
]);

/** 章节英文名 → 中文短题（杂志感，不写长段） */
const CHAPTER_ZH: Record<string, string> = {
  "Shape of a Century": "世纪的形状",
  "Anchors of Valuation": "估值锚点",
  "Rhythm of Crisis": "危机节奏",
  "Anatomy of the Index": "指数解剖",
  "The Long Lens": "长焦镜头",
  "The Stretch of Valuation": "估值扩张",
  "Crisis Cadence": "危机节拍",
  "The Thirty-Year Arc": "三十年弧线",
  "The Heart of the Cycle": "周期之心",
  "Inside the Index": "指数内部",
  "Cross-basis Ratios": "跨基准比率",
  "The Twenty-Seven-Year Arc": "二十七年弧线",
  "Intrayear Amplitude": "年内振幅",
  "The Shape of Concentration": "集中度的形状",
  "The Seam of 2018": "2018 分水岭",
  "2008, The Plague Year": "2008 · 瘟疫之年",
  "Curve, Classification, Composition": "曲线 · 分类 · 构成",
  "The Equal-Weight Lens": "等权镜头",
  "Market Dominance": "市场主导",
  "Per-Member Amplitude": "成员振幅",
  "Seven Names or One Trade": "七股，或一笔交易",
  "Ancestors of M7": "七巨头前史",
  "The Roster": "名录",
  "The Long-Lived": "长青者",
  "The Crowns": "王冠",
  "The Eclipse": "日蚀",
  "The Concurrents": "同榜者",
  Aftermath: "余波",
  "Share at Peak": "峰值份额",
  "PE at Peak": "峰值市盈率",
  Concentration: "集中度",
  "Drawdowns & Recoveries": "回撤与复苏",
  "Issuance & Retirement": "发行与注销",
};

/** 面板短题（目录 / 旗舰标题用，避免长问句） */
export const PANEL_SHORT_ZH: Record<string, string> = {
  /* 标普 500 */
  annual: "年回报",
  "annual-dist": "年回报分布",
  "annualized-matrix": "买入年 × 卖出年",
  rolling: "五年滚动回报",
  "sp500-logyoy": "对数同比 · 牛熊分界",
  drawdown: "历史回撤",
  "intrayear-dd": "年内回撤 vs 年末",
  volatility: "实现波动率",
  vix: "VIX 与标普",
  monthly: "月度热图",
  pe: "席勒 CAPE",
  aiae: "AIAE 仓位",
  eps: "TTM 每股收益",
  roe: "净资产收益率",
  "forward-pe": "静态 / 动态市盈率",
  "return-details": "总回报分解",
  "sp500-driver-decomp": "估值 × 盈利驱动",
  m7: "七巨头指数",
  sectors: "行业结构",
  scatter: "成分股气泡图",
  changes: "成分股进出",
  rules: "入选规则",
  /* 纳斯达克 */
  "nasdaq-composite": "纳指综指",
  "nasdaq-logyoy": "纳指对数同比",
  "nasdaq100-annual": "QQQ 年回报",
  "ndx-annual-dist": "纳指 100 回报分布",
  "ndx-matrix": "买入年 × 卖出年",
  "ndx-rolling": "五年滚动回报",
  "ndx-forward-pe": "纳指 100 估值",
  "ndx-driver-decomp": "重估 × 修正",
  "ndx-drawdown": "纳指 100 回撤",
  "ndx-intrayear-dd": "年内回撤 vs 年末",
  "ndx-volatility": "纳指波动率",
  "ndx-vxn": "VXN 波动指数",
  "ndx-monthly": "月度热图",
  "ndx-return-details": "QQQ 回报分解",
  "nasdaq100-companies": "成分公司",
  "nasdaq100-weights": "头部权重",
  "nasdaq100-ytd": "回报排行",
  /* 半导体 */
  "semi-price": "费半走势",
  "semi-annual": "费半年回报",
  "semi-annual-dist": "费半回报分布",
  "semi-intrayear-dd": "年内回撤 vs 年末",
  "semi-composition": "成分拆解",
  "semi-smh": "SMH 持仓",
  "semi-memory": "存储阵营",
  "semi-ratios": "相对强度",
  "semi-memory-valuation": "存储估值",
  /* 信息技术 XLK */
  "xlk-price": "XLK 走势",
  "xlk-annual": "XLK 年回报",
  "xlk-annual-dist": "XLK 回报分布",
  "xlk-intrayear-dd": "年内回撤 vs 年末",
  "xlk-holdings": "头部持仓",
  "xlk-reclass": "2018 大调仓",
  /* 金融 XLF */
  "fin-price": "XLF 走势",
  "fin-annual": "XLF 年回报",
  "fin-annual-dist": "XLF 回报分布",
  "fin-intrayear-dd": "年内回撤 vs 年末",
  "fin-crisis": "2008 金融危机",
  "fin-rates": "利率曲线",
  "fin-reclass": "2023 大调仓",
  "fin-holdings": "持仓结构",
  /* 七巨头 */
  "mag7-index": "七巨头等权",
  "mag7-concentration": "七巨头集中度",
  "mag7-drawdown": "成员回撤",
  "mag7-correlation": "相关性矩阵",
  "mag7-ai-valuation": "AI 估值对照",
  "mag7-predecessors": "前辈对照",
  /* 市值王朝 */
  "top10-roster": "十强名录",
  "top10-lineage": "长青者",
  "top10-crowns": "王冠",
  "top10-eclipse": "日蚀",
  "top10-concurrents": "同榜者",
  "top10-aftermath": "余波",
  "top10-spx-share": "峰值份额",
  "top10-pe-at-entry": "峰值市盈率",
  /* 集中度与回撤研究 */
  "cp-conc-top10": "十强集中度",
  "cp-conc-top3": "龙头 vs 指数",
  "cp-conc-size": "大盘 vs 小盘",
  "cp-dd-base-rates": "回撤基准率",
  "cp-dd-forward-returns": "触底后回报",
  "cp-dd-timing": "顶底时点",
  "cp-dd-paths": "复苏路径",
  "cp-dd-cases": "NVDA vs INTC",
  "cp-iss-overview": "发行 vs 注销",
  "cp-iss-deciles": "激励稀释",
  "cp-iss-quadrant": "激励 × 回购",
};

export type ParsedChapter = {
  raw: string;
  book: string;
  roman: string;
  titleEn: string;
  titleZh: string;
};

export function parseChapter(raw?: string): ParsedChapter {
  const s = (raw || "").trim();
  if (!s) {
    return { raw: "", book: "", roman: "", titleEn: "", titleZh: "" };
  }
  const m = s.match(/^(.*?)\s*[·•]\s*([IVXLC]+)\.\s*(.+)$/i);
  if (m) {
    const titleEn = m[3].trim();
    return {
      raw: s,
      book: m[1].trim(),
      roman: m[2].toUpperCase(),
      titleEn,
      titleZh: CHAPTER_ZH[titleEn] || titleEn,
    };
  }
  return { raw: s, book: "", roman: "", titleEn: s, titleZh: s };
}

export function panelShortTitle(panel: ChroniclePanel): string {
  return PANEL_SHORT_ZH[panel.id] || panel.title.replace(/^S&P 500\s+/i, "").replace(/^Nasdaq\s+/i, "");
}

export type ChapterBundle = {
  key: string;
  parsed: ParsedChapter;
  flagship: ChroniclePanel;
  rest: ChroniclePanel[];
  all: ChroniclePanel[];
};

export type SectionBundle = {
  category: ChronicleCategory;
  roman: string;
  label: string;
  labelEn: string;
  chapters: ChapterBundle[];
  panels: ChroniclePanel[];
};

export function buildMagazineSections(panels: ChroniclePanel[]): SectionBundle[] {
  const byCat = new Map<ChronicleCategory, ChroniclePanel[]>();
  for (const p of panels) {
    const cat = inferCategory(p);
    const list = byCat.get(cat);
    if (list) list.push(p);
    else byCat.set(cat, [p]);
  }

  const cats = Array.from(byCat.keys()).sort(
    (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order
  );

  return cats.map((category) => {
    const list = byCat.get(category) || [];
    const chapterOrder: string[] = [];
    const chapterMap = new Map<string, ChroniclePanel[]>();
    for (const p of list) {
      const key = p.chapter || `${CATEGORY_META[category].labelEn} · Misc`;
      if (!chapterMap.has(key)) {
        chapterMap.set(key, []);
        chapterOrder.push(key);
      }
      chapterMap.get(key)!.push(p);
    }

    const chapters: ChapterBundle[] = chapterOrder.map((key) => {
      const all = chapterMap.get(key)!;
      const flagship =
        all.find((p) => FLAGSHIP_IDS.has(p.id)) || all[0];
      const rest = all.filter((p) => p.id !== flagship.id);
      return {
        key,
        parsed: parseChapter(key),
        flagship,
        rest,
        all,
      };
    });

    // 章节按罗马数字排序（源数据顺序可能与刊号不一致，如 III 排在 II 前）
    const romanValue = (r: string) => {
      const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
      let total = 0;
      for (let i = 0; i < r.length; i++) {
        const cur = map[r[i]] ?? 0;
        const next = map[r[i + 1]] ?? 0;
        total += cur < next ? -cur : cur;
      }
      return total || Number.MAX_SAFE_INTEGER;
    };
    chapters.sort(
      (a, b) => romanValue(a.parsed.roman) - romanValue(b.parsed.roman)
    );

    return {
      category,
      roman: SECTION_ROMAN[category],
      label: CATEGORY_META[category].label,
      labelEn: CATEGORY_META[category].labelEn,
      chapters,
      panels: list,
    };
  });
}

export type CoverStats = {
  compound?: string;
  latest?: string;
  sample?: string;
  updated?: string;
};

export function coverStatsFromAnnual(data: unknown): CoverStats {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  const series = Array.isArray(o.series) ? (o.series as Record<string, unknown>[]) : [];
  const years = series
    .map((p) => Number(p.year))
    .filter((y) => Number.isFinite(y));
  const y0 = years.length ? Math.min(...years) : null;
  const y1 = years.length ? Math.max(...years) : null;
  const last = series.length ? series[series.length - 1] : null;
  const latestVal =
    last && typeof last.value === "number"
      ? `${(last.value as number) >= 0 ? "+" : ""}${(last.value as number).toFixed(1)}%`
      : undefined;

  return {
    compound:
      typeof o.average === "number" ? `${o.average.toFixed(2)}%` : undefined,
    latest: latestVal,
    sample: y0 != null && y1 != null ? `${y0}–${y1}` : undefined,
    updated: typeof o.updated === "string" ? o.updated : undefined,
  };
}
