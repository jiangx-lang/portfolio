export interface PortfolioSlice {
  label: string;
  pct: number;
  color: string;
}

export interface PortfolioFund {
  name: string;
  pct: number;
  color: string;
}

export interface WhimsicalPortfolio {
  id: number;
  riskLevel: 1 | 2 | 3 | 4 | 5;
  riskLabel: string;
  name: string;
  subtitle: string;
  accentColor: string;
  slices: PortfolioSlice[];
  funds: PortfolioFund[];
  metrics: { ret: string; vol: string; maxDD: string };
  scenarios: { base: string; inflationGeo: string; aiRecession: string };
  narrative: string;
}

export const WHIMSICAL_PORTFOLIOS: WhimsicalPortfolio[] = [
  {
    id: 0,
    riskLevel: 1,
    riskLabel: "保守",
    accentColor: "#1D9E75",
    name: "滞胀护城河",
    subtitle: "生物学刚需 · 浮动息票 · 实物商品",
    slices: [
      { label: "医疗刚需", pct: 30, color: "#1D9E75" },
      { label: "浮动货币市场", pct: 30, color: "#5DCAA5" },
      { label: "实物商品", pct: 25, color: "#9FE1CB" },
      { label: "短期美债", pct: 15, color: "#C8EEE1" },
    ],
    funds: [
      { name: "施罗德医疗创新基金 (Fund 98)", pct: 30, color: "#1D9E75" },
      { name: "摩根美元浮动货币基金 (Fund 93)", pct: 30, color: "#5DCAA5" },
      { name: "施罗德商品基金 (Fund 143)", pct: 25, color: "#9FE1CB" },
      { name: "法巴美元短期债券基金 (Fund 77)", pct: 15, color: "#C8EEE1" },
    ],
    metrics: { ret: "~4.9%", vol: "~4%", maxDD: "-10%" },
    scenarios: { base: "+4.4%", inflationGeo: "+1.2%", aiRecession: "+0.8%" },
    narrative: `当AI正在破坏初级白领消费能力，高利率使长久期债券危险——本组合选择三条抵抗路径。<strong>Eli Lilly的GLP-1药物、AbbVie的免疫学壁垒</strong>完全免疫于失业潮；浮动息票随美联储「更高更久」政策水涨船高；铜与白银则是AI数据中心建设的刚性工业金属。`,
  },
  {
    id: 1,
    riskLevel: 2,
    riskLabel: "稳健",
    accentColor: "#185FA5",
    name: "AI物理闭环",
    subtitle: "算力 · 电力 · 传统能源对冲",
    slices: [
      { label: "AI科技核心", pct: 22, color: "#185FA5" },
      { label: "清洁能源/电网", pct: 18, color: "#378ADD" },
      { label: "传统化石能源", pct: 15, color: "#85B7EB" },
      { label: "投资级债券", pct: 20, color: "#B5D4F4" },
      { label: "新兴市场主权债", pct: 15, color: "#D0E8FB" },
      { label: "黄金矿业", pct: 10, color: "#0C447C" },
    ],
    funds: [
      { name: "富兰克林科技基金 (Fund 25)", pct: 22, color: "#185FA5" },
      { name: "贝莱德可持续能源基金 (Fund 14)", pct: 18, color: "#378ADD" },
      { name: "贝莱德世界能源基金 (Fund 141)", pct: 15, color: "#85B7EB" },
      { name: "环球投资级债券基金", pct: 20, color: "#B5D4F4" },
      { name: "邓普顿环球总收益基金 (Fund 134)", pct: 15, color: "#D0E8FB" },
      { name: "贝莱德世界黄金基金", pct: 10, color: "#0C447C" },
    ],
    metrics: { ret: "~6.4%", vol: "~7.4%", maxDD: "-18%" },
    scenarios: { base: "+5.3%", inflationGeo: "-1.9%", aiRecession: "-3.8%" },
    narrative: `全球2800个新建数据中心将对电网造成巨压——本组合将算力（Fund 25的NVIDIA 9.66%、TSMC 4.40%）与电力（Fund 14的NextEra、National Grid）纳入同一闭环。<strong>投资Fund 14是通过公用事业的壳，赚AI扩张的钱</strong>。Fund 141的油气巨头则将地缘风险转化为Alpha。`,
  },
  {
    id: 2,
    riskLevel: 3,
    riskLabel: "平衡",
    accentColor: "#BA7517",
    name: "数字地产收租",
    subtitle: "向AI军备竞赛的参与者收租",
    slices: [
      { label: "AI科技/软件", pct: 25, color: "#BA7517" },
      { label: "数据中心REIT", pct: 25, color: "#EF9F27" },
      { label: "化石能源", pct: 15, color: "#FAC775" },
      { label: "实物商品", pct: 10, color: "#FAEEDA" },
      { label: "短期美债", pct: 15, color: "#E8D5B0" },
      { label: "新兴市场债", pct: 10, color: "#D4B880" },
    ],
    funds: [
      { name: "摩根美国科技基金 (Fund 82)", pct: 25, color: "#BA7517" },
      { name: "富达环球房地产基金 (Fund 49)", pct: 25, color: "#EF9F27" },
      { name: "贝莱德世界能源基金 (Fund 141)", pct: 15, color: "#FAC775" },
      { name: "施罗德商品基金 (Fund 143)", pct: 10, color: "#854F0B" },
      { name: "法巴美元短期债券基金 (Fund 77)", pct: 15, color: "#633806" },
      { name: "邓普顿环球总收益基金 (Fund 134)", pct: 10, color: "#412402" },
    ],
    metrics: { ret: "~7.6%", vol: "~11.5%", maxDD: "-29%" },
    scenarios: { base: "+6.1%", inflationGeo: "-4.6%", aiRecession: "-9.5%" },
    narrative: `不参与AI算法竞争，而是通过物理基础设施向所有竞争者「收租」。<strong>Fund 49的Prologis（8.7%）是全球最大物流仓储商；Digital Realty（5.1%）是顶尖数据中心REIT</strong>——随着6500亿美元AI资本投入部署，科技巨头必须租用这些空间。`,
  },
  {
    id: 3,
    riskLevel: 4,
    riskLabel: "积极",
    accentColor: "#993C1D",
    name: "劳动力替代红利",
    subtitle: "裁员增效 · 欧洲军工 · 亚洲半导体垄断",
    slices: [
      { label: "AI劳动力替代", pct: 28, color: "#993C1D" },
      { label: "欧洲军工重工", pct: 25, color: "#D85A30" },
      { label: "亚洲半导体高息", pct: 25, color: "#F0997B" },
      { label: "实物商品", pct: 12, color: "#F5C4B3" },
      { label: "黄金矿业", pct: 10, color: "#FAECE7" },
    ],
    funds: [
      { name: "景顺环球消费趋势基金 (Fund 73)", pct: 28, color: "#993C1D" },
      { name: "联博欧洲股票基金 (Fund 102)", pct: 25, color: "#D85A30" },
      { name: "摩根亚洲高息基金 (Fund 120)", pct: 25, color: "#F0997B" },
      { name: "施罗德商品基金 (Fund 143)", pct: 12, color: "#712B13" },
      { name: "贝莱德世界黄金基金", pct: 10, color: "#4A1B0C" },
    ],
    metrics: { ret: "~8.4%", vol: "~14%", maxDD: "-35%" },
    scenarios: { base: "+6.9%", inflationGeo: "-7.0%", aiRecession: "-15.2%" },
    narrative: `失业率上升通常被视为利空，但若失业源于企业主动用AI替代人工，这恰恰是<strong>利润率永久性扩张的买入信号</strong>。Fund 73的Tesla（9.9%）、Amazon（8.4%）正通过AI重塑物理与数字劳动；Fund 120的TSMC（9.5%）垄断所有芯片的物理制造——无论谁赢得AI算法竞争，都绕不过这道关卡。`,
  },
  {
    id: 4,
    riskLevel: 5,
    riskLabel: "激进",
    accentColor: "#A32D2D",
    name: "宏观逆向工程",
    subtitle: "银行息差 · AI蓝筹贝塔 · 新兴市场主权债",
    slices: [
      { label: "全球金融息差", pct: 25, color: "#A32D2D" },
      { label: "美国蓝筹AI核心", pct: 25, color: "#E24B4A" },
      { label: "AI劳动力替代", pct: 15, color: "#F09595" },
      { label: "新兴市场主权债", pct: 20, color: "#F7C1C1" },
      { label: "实物商品", pct: 10, color: "#FAECE7" },
      { label: "黄金矿业", pct: 5, color: "#E8C8C8" },
    ],
    funds: [
      { name: "贝莱德世界金融基金 (Fund 38)", pct: 25, color: "#A32D2D" },
      { name: "摩根美国基金 (Fund 100)", pct: 25, color: "#E24B4A" },
      { name: "景顺环球消费趋势基金 (Fund 73)", pct: 15, color: "#F09595" },
      { name: "邓普顿环球总收益基金 (Fund 134)", pct: 20, color: "#791F1F" },
      { name: "施罗德商品基金 (Fund 143)", pct: 10, color: "#501313" },
      { name: "贝莱德世界黄金基金", pct: 5, color: "#300A0A" },
    ],
    metrics: { ret: "~9.1%", vol: "~15.8%", maxDD: "-40%" },
    scenarios: { base: "+7.8%", inflationGeo: "-9.2%", aiRecession: "-19.4%" },
    narrative: `三重逆向工程同时运行：<strong>高通胀→银行NIM扩大（Fund 38的BofA、Citi）；美元购买力受损→新兴市场高实际收益率主权债（印度4.09%、马来西亚6.80%）；AI革命→Nvidia/Microsoft/Broadcom作为时代贝塔锚点</strong>。Berkshire Hathaway（3%）提供财务安全垫。`,
  },
];
