/**
 * 使用成长体系：登录后使用越多，权限越大。
 * 不直接卖会员，而是把“付费功能”包装成“活跃奖励”。
 */

export type FeatureKey =
  | "qd"
  | "mrf"
  | "wmp"
  | "notes"
  | "podcast"
  | "portfolio"
  | "stock"
  | "ai_summary"
  | "risk"
  | "deep_analysis"
  | "signals"
  | "pdf_export";

export type EventType =
  | "page_view"
  | "ai_generate"
  | "content_read"
  | "fund_compare"
  | "login_daily"
  | "report_export"
  | "watchlist_add";

export interface LevelDefinition {
  level: number;
  name: string;
  tagline: string;
  minXp: number;
  color: "blue" | "gold" | "purple";
}

export interface FeatureGate {
  key: FeatureKey;
  name: string;
  icon: string;
  description: string;
  requiredLevel: number;
  route?: string;
}

export const XP_REWARDS: Record<EventType, number> = {
  page_view: 5,
  ai_generate: 20,
  content_read: 10,
  fund_compare: 15,
  login_daily: 10,
  report_export: 25,
  watchlist_add: 10,
};

export const LEVELS: LevelDefinition[] = [
  { level: 1, name: "新成员", tagline: "开启投研之旅", minXp: 0, color: "blue" },
  { level: 2, name: "探索者", tagline: "解锁 AI 与自选", minXp: 50, color: "blue" },
  { level: 3, name: "分析师", tagline: "解锁深度与风险", minXp: 150, color: "gold" },
  { level: 4, name: "资深用户", tagline: "解锁信号与导出", minXp: 300, color: "gold" },
  { level: 5, name: "Atlas 领航员", tagline: "所有能力开放", minXp: 600, color: "purple" },
];

export const FEATURES: FeatureGate[] = [
  { key: "qd", name: "QDII 基金池", icon: "🏦", description: "浏览与筛选 QDII 基金", requiredLevel: 1, route: "/qd" },
  { key: "mrf", name: "MRF 基金池", icon: "🌐", description: "互认基金穿透分析", requiredLevel: 1, route: "/mrf" },
  { key: "wmp", name: "WMP 净值", icon: "📈", description: "净值跟踪与对比", requiredLevel: 1, route: "/wmp" },
  { key: "notes", name: "市场笔记", icon: "📝", description: "每日市场报告与解读", requiredLevel: 1, route: "/notes" },
  { key: "podcast", name: "播客", icon: "🎙️", description: "音频市场解读", requiredLevel: 1, route: "/podcast" },
  { key: "portfolio", name: "Model Portfolio", icon: "📊", description: "标准组合与再平衡", requiredLevel: 2, route: "/portfolio" },
  { key: "stock", name: "美股详情", icon: "🇺🇸", description: "个股、期权与策略", requiredLevel: 2, route: "/stock" },
  { key: "ai_summary", name: "AI 摘要", icon: "✨", description: "AI 自动生成基金/个股摘要", requiredLevel: 2 },
  { key: "risk", name: "宏观风险", icon: "🛡️", description: "交互式宏观风险仪表板", requiredLevel: 3, route: "/risk" },
  { key: "deep_analysis", name: "持仓深度分析", icon: "🔍", description: "一页纸投研报告", requiredLevel: 3 },
  { key: "signals", name: "AI 信号中心", icon: "📡", description: "宏观/行业/个股信号", requiredLevel: 4, route: "/signals" },
  { key: "pdf_export", name: "PDF 导出", icon: "📄", description: "导出专业研报", requiredLevel: 4 },
];

export function getLevel(xp: number): LevelDefinition {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXp) current = lvl;
    else break;
  }
  return current;
}

export function getNextLevel(xp: number): LevelDefinition | null {
  for (const lvl of LEVELS) {
    if (xp < lvl.minXp) return lvl;
  }
  return null;
}

export function getProgressToNext(xp: number): {
  currentLevel: LevelDefinition;
  nextLevel: LevelDefinition | null;
  levelXp: number;
  nextLevelXp: number;
  progressPct: number;
  xpToNext: number;
} {
  const currentLevel = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const levelXp = currentLevel.minXp;
  const nextLevelXp = nextLevel?.minXp ?? currentLevel.minXp;
  const xpInLevel = xp - levelXp;
  const xpRange = Math.max(1, nextLevelXp - levelXp);
  const xpToNext = Math.max(0, nextLevelXp - xp);
  const progressPct = nextLevel ? Math.min(100, Math.round((xpInLevel / xpRange) * 100)) : 100;
  return { currentLevel, nextLevel, levelXp, nextLevelXp, progressPct, xpToNext };
}

export function isFeatureUnlocked(featureKey: FeatureKey, xp: number): boolean {
  const feature = FEATURES.find((f) => f.key === featureKey);
  if (!feature) return true;
  return getLevel(xp).level >= feature.requiredLevel;
}

export function getFeatureGate(featureKey: FeatureKey): FeatureGate | undefined {
  return FEATURES.find((f) => f.key === featureKey);
}

export function getUnlockedFeatures(xp: number): FeatureGate[] {
  const level = getLevel(xp).level;
  return FEATURES.filter((f) => f.requiredLevel <= level);
}

export function getLockedFeatures(xp: number): FeatureGate[] {
  const level = getLevel(xp).level;
  return FEATURES.filter((f) => f.requiredLevel > level);
}

export function getLockedRoutes(xp: number): string[] {
  return FEATURES.filter((f) => f.route && f.requiredLevel > getLevel(xp).level)
    .map((f) => f.route as string);
}

export function xpNeededForFeature(featureKey: FeatureKey): number {
  const feature = FEATURES.find((f) => f.key === featureKey);
  if (!feature) return 0;
  const level = LEVELS.find((l) => l.level === feature.requiredLevel);
  return level?.minXp ?? 0;
}

export function getXpTip(eventType: EventType): string {
  const tips: Record<EventType, string> = {
    page_view: "浏览页面",
    ai_generate: "使用 AI 摘要",
    content_read: "阅读市场笔记/播客",
    fund_compare: "对比基金",
    login_daily: "每日登录",
    report_export: "导出报告",
    watchlist_add: "添加自选",
  };
  return `+${XP_REWARDS[eventType]} XP · ${tips[eventType]}`;
}
