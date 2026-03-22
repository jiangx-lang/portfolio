/**
 * QD 基金池筛选：与 `tag_taxonomy.category` 对齐的多行分组；债券谱系对应 Gov/HY/Corp 等 tag_name。
 * 持仓层 `qdiiTagMap.ts` 穿透筛选后续版本接入。
 */

/** 债券类 theme 标签：只出现在「固收谱系」，不出现在「主题与赛道」 */
export const QD_BOND_THEME_TAG_NAMES = new Set<string>([
  "CorpBond",
  "GovtBond-EM",
  "GovtBond-EU",
  "GovtBond-US",
  "HYBond",
  "FloatingRate",
]);

/** 固收谱系（用户面向文案） */
export const QD_BOND_SPECTRUM_OPTIONS = [
  "全部",
  "利率/主权IG",
  "投资级信用",
  "高收益",
  "新兴市场债",
  "亚洲债",
] as const;

export type QdBondSpectrumOption = (typeof QD_BOND_SPECTRUM_OPTIONS)[number];

export const QD_BOND_SPECTRUM_GROUPS: Record<
  Exclude<QdBondSpectrumOption, "全部">,
  readonly string[]
> = {
  "利率/主权IG": ["GovtBond-US", "GovtBond-EU"],
  投资级信用: ["CorpBond", "FloatingRate"],
  高收益: ["HYBond"],
  新兴市场债: ["GovtBond-EM"],
  亚洲债: [],
};

export type QdTagRow = { tag_name: string; category: string };

export function qdRegionTagNames(rows: QdTagRow[]): string[] {
  return rows
    .filter((r) => r.category === "region")
    .map((r) => r.tag_name)
    .sort((a, b) => a.localeCompare(b));
}

export function qdSectorTagNames(rows: QdTagRow[]): string[] {
  return rows
    .filter((r) => r.category === "sector")
    .map((r) => r.tag_name)
    .sort((a, b) => a.localeCompare(b));
}

/** theme 中剔除债券类 tag */
export function qdThemeOnlyTagNames(rows: QdTagRow[]): string[] {
  const bond = QD_BOND_THEME_TAG_NAMES;
  return rows
    .filter((r) => r.category === "theme")
    .map((r) => r.tag_name)
    .filter((n) => !bond.has(n))
    .sort((a, b) => a.localeCompare(b));
}

export function qdStyleCustomTagNames(rows: QdTagRow[]): string[] {
  const pick = (cat: string) =>
    rows
      .filter((r) => r.category === cat)
      .map((r) => r.tag_name)
      .sort((a, b) => a.localeCompare(b));
  return [...pick("style"), ...pick("custom")];
}

/**
 * 基金 Top3 标签同时满足：地域 ∧ 行业 ∧ 主题 ∧ 策略/定制 ∧ 固收谱系（各维度「全部」跳过）
 */
export function fundMatchesQdFundFilters(
  fundTags: string[] | undefined,
  region: string,
  sector: string,
  themeOnly: string,
  styleCustom: string,
  bond: QdBondSpectrumOption
): boolean {
  const tags = fundTags || [];

  if (region !== "全部" && !tags.includes(region)) return false;
  if (sector !== "全部" && !tags.includes(sector)) return false;
  if (themeOnly !== "全部" && !tags.includes(themeOnly)) return false;
  if (styleCustom !== "全部" && !tags.includes(styleCustom)) return false;

  if (bond !== "全部") {
    const group = QD_BOND_SPECTRUM_GROUPS[bond];
    if (!group.length) return false;
    if (!group.some((t) => tags.includes(t))) return false;
  }

  return true;
}
