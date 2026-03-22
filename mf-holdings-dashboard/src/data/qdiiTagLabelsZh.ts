/**
 * QD 基金 tag_taxonomy.tag_name → 界面中文展示（筛选芯片、列表 Top3）。
 * 内部筛选仍以英文 tag_name 与 fund.tags 对齐；未收录名称原样显示。
 * 专有缩写（HALO、SaaS、AI、QDUR 等）保持英文可读性。
 */

export const QD_TAG_LABEL_ZH: Record<string, string> = {
  // 地域 region
  Asia: "亚洲",
  China: "中国",
  EM: "新兴市场",
  Europe: "欧洲",
  India: "印度",
  Japan: "日本",
  Korea: "韩国",
  LatAm: "拉美",
  MiddleEast: "中东",
  Taiwan: "台湾",
  US: "美国",
  UK: "英国",
  Global: "全球",
  ASEAN: "东盟",

  // 行业 sector
  ConsumerDisc: "非必需消费",
  ConsumerStaples: "必需消费",
  Energy: "能源",
  Financials: "金融",
  Healthcare: "医疗健康",
  Industrials: "工业",
  Infrastructure: "基础设施",
  Materials: "原材料",
  "Real Estate": "房地产",
  Semiconductors: "半导体",
  Technology: "科技",
  Telecom: "电信",
  Utilities: "公用事业",

  // 策略 style + 定制 custom
  Growth: "成长",
  Income: "收益",
  LowVol: "低波动",
  Momentum: "动量",
  Value: "价值",
  "A-AIpower": "A-AIpower",
  "H-HardAssets": "H-硬资产",
  "L-LowVol": "L-低波动",
  "O-OilHedge": "O-原油对冲",

  // 主题 theme（非债券类）
  AI: "AI",
  AIChips: "AI 芯片",
  Biotech: "生物科技",
  CleanEnergy: "清洁能源",
  Cybersecurity: "网络安全",
  DataCenter: "数据中心",
  EV: "电动汽车",
  HighDividend: "高股息",
  SaaS: "SaaS",
  HALO: "HALO",

  // 固收类 tag（列表里可能出现）
  CorpBond: "投资级信用",
  FloatingRate: "浮息债",
  "GovtBond-EM": "新兴主权债",
  "GovtBond-EU": "欧洲主权债",
  "GovtBond-US": "美债/主权",
  HYBond: "高收益债",
  AsiaBond: "亚洲债",
};

/** 筛选芯片 / 表格 / 详情中的单标签展示 */
export function qdTagLabelZh(tag: string): string {
  if (!tag || tag === "全部") return tag;
  const t = tag.trim();
  return QD_TAG_LABEL_ZH[t] ?? QD_TAG_LABEL_ZH[tag] ?? t;
}

/** Top3 等多标签拼接 */
export function qdTagsJoinZh(tags: string[]): string {
  return tags.map(qdTagLabelZh).join(" · ");
}
