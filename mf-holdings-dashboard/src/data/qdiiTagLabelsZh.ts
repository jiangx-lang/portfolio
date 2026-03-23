/**
 * QD 基金 tag_taxonomy.tag_name → 界面中文展示。
 * 筛选与 API 仍以英文 tag_name 为准；未收录名称原样显示。
 */

const ZH_LABELS: Record<string, string> = {
  // asset_class
  Bond: "债券",
  Commodity: "大宗商品",
  Equity: "股票",
  "Investment Grade": "投资级",
  "Money Market": "货币市场",
  "Multi Asset": "多资产",
  "Non-Investment Grade": "非投资级",
  REIT: "REITs",
  // region
  US: "美国",
  Europe: "欧洲",
  Asia: "亚洲",
  China: "中国",
  Japan: "日本",
  Global: "全球",
  "Emerging Markets": "新兴市场",
  // sector
  Technology: "科技",
  Financials: "金融",
  Healthcare: "医疗健康",
  Consumer: "消费",
  Energy: "能源",
  Industrials: "工业",
  Materials: "原材料",
  "Real Estate": "房地产",
  "Communication Services": "电信",
  Utilities: "公用事业",
  // theme
  AI: "AI",
  "AI Hardware": "AI硬件",
  "AI Software": "AI软件",
  "AI Infrastructure": "AI基建",
  "AI Datacenter": "AI数据中心",
  Semiconductor: "半导体",
  "Semiconductor Equipment": "半导体设备",
  Cloud: "云计算",
  SaaS: "SaaS",
  Cybersecurity: "网络安全",
  Internet: "互联网",
  "China Internet": "中概互联",
  Robotics: "机器人",
  EV: "电动汽车",
  "Energy Transition": "清洁能源",
  Gold: "黄金",
  Infrastructure: "基础设施",
  Defense: "国防",
  Datacenter: "数据中心",
  "Enterprise Software": "企业软件",
  "Asset Management": "资产管理",
  Insurance: "保险",
  Logistics: "物流",
  HighDividend: "高股息",
  // style
  Growth: "成长",
  Value: "价值",
  Quality: "质量",
  Income: "收益",
  "Low Vol": "低波动",
  Blend: "混合",
  "Mega Cap": "超大盘",
  "Broad Market": "宽基",
  Concentrated: "集中持仓",
  // custom
  HALO: "HALO",
  halo: "HALO",
  core: "核心",
  satellite: "卫星",
  aggressive: "进取",
  defensive: "防御",
  watchlist: "观察名单",
};

export function qdTagLabelZh(tag: string): string {
  return ZH_LABELS[tag] ?? tag;
}

export function qdTagsJoinZh(tags: string[]): string {
  return tags.map(qdTagLabelZh).join(" · ");
}
