export interface QdThemeCard {
  id: string;
  emoji: string;
  title: string;
  subtitle: string; // 一句话说明选股逻辑
  anchorTags: string[]; // 与 tag_taxonomy.tag_name 对应
  insightText: string; // 锦囊文案，点击展开显示
}

export const QD_THEME_CARDS: QdThemeCard[] = [
  {
    id: "ai-power",
    emoji: "⚡",
    title: "隐形电网",
    subtitle: "重仓 AI 用电基建的基金",
    anchorTags: ["A-AIpower", "Utilities", "Infrastructure"],
    insightText:
      "数据中心的电力需求正在重塑全球电网投资逻辑。这些基金通过持有电力运营商、输电网络和工业基建，间接捕捉 AI 算力扩张带来的能源需求红利。",
  },
  {
    id: "hard-assets",
    emoji: "🪨",
    title: "硬资产盾牌",
    subtitle: "管道、矿业、REIT 的实物资产组合",
    anchorTags: ["H-HardAssets", "Real Estate", "Materials", "Infrastructure"],
    insightText:
      "通胀环境下，实物资产是天然的盾牌。这些基金重仓的是不可复制的资产：管道网络、稀有矿产、优质地段的 REIT，它们的价值与通胀正相关。",
  },
  {
    id: "ai-chips",
    emoji: "🤖",
    title: "算力军备",
    subtitle: "AI 芯片与数据中心基础设施",
    anchorTags: ["AIChips", "AI", "DataCenter", "Semiconductors"],
    insightText:
      "不是每只科技基金都真正重仓 AI。这里筛选出的是那些把弹药真正压在 NVIDIA、TSMC、ASML 等算力核心标的上的基金。",
  },
  {
    id: "oil-hedge",
    emoji: "🛡️",
    title: "地缘对冲",
    subtitle: "石油、黄金、大宗商品的地缘保险",
    anchorTags: ["O-OilHedge", "Energy", "Materials"],
    insightText:
      "地缘风险上升时，石油天然气和黄金是传统的避险锚。这些基金的持仓结构天然具备对冲地缘冲击的能力。",
  },
  {
    id: "asia-hidden",
    emoji: "🌏",
    title: "亚洲隐形冠军",
    subtitle: "台湾、韩国、日本的供应链核心",
    anchorTags: ["Taiwan", "Korea", "Japan"],
    insightText:
      "全球科技供应链的真正瓶颈往往藏在亚洲：台积电的晶圆、三星的 HBM、SK海力士的存储。这些基金让你通过 QDII 额度捕捉这些国内难以直接配置的标的。",
  },
  {
    id: "income-fortress",
    emoji: "💰",
    title: "现金流堡垒",
    subtitle: "高股息 + 低波动的稳定收益型",
    anchorTags: ["L-LowVol", "HighDividend", "Income"],
    insightText:
      "不追涨停，只求稳定分红。这些基金持仓以公用事业、消费必需品、高股息蓝筹为主，适合作为组合中的压舱石。",
  },
];

