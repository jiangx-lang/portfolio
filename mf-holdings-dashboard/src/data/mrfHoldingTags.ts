// Tags for MRF fund holdings
// 地域: geography of the holding company
// 主题: investment theme
// 债券: bond type (for bond holdings only)
// 高股息: large-cap dividend stocks popular with Asian investors

import {
  resolveMrfHoldingTagLookupKey,
  tradToSimplifiedHoldingName,
} from "@/data/mrfHoldingNameUnified";

export type HoldingTag = {
  地域?: "中国大陆" | "中国香港" | "中国台湾" | "日本" | "韩国" | "其他";
  /** 含参考表 Dimension×Logic：HALO / 垄断龙头 / 现金奶牛 / 宏观成长 / 通胀避险 / 利率锚定 等 */
  主题?: (
    | "HALO"
    | "高股息"
    | "科技"
    | "AI硬件"
    | "AI软件"
    | "垄断龙头"
    | "现金奶牛"
    | "宏观成长"
    | "通胀避险"
    | "利率锚定"
  )[];
  债券?: "投资级别债" | "垃圾债" | "亚洲债";
};

export const MRF_REGION_OPTIONS = [
  "全部",
  "中国大陆",
  "中国香港",
  "中国台湾",
  "日本",
  "韩国",
  "其他",
] as const;
export type MrfRegionOption = (typeof MRF_REGION_OPTIONS)[number];

export const MRF_THEME_OPTIONS = [
  "全部",
  "HALO",
  "垄断龙头",
  "现金奶牛",
  "宏观成长",
  "通胀避险",
  "利率锚定",
  "高股息",
  "科技",
  "AI硬件",
  "AI软件",
] as const;
export type MrfThemeOption = (typeof MRF_THEME_OPTIONS)[number];

export const MRF_BOND_OPTIONS = ["全部", "投资级别债", "垃圾债", "亚洲债"] as const;
export type MrfBondOption = (typeof MRF_BOND_OPTIONS)[number];

/** Key = holding_name (matches holdingTickerMap keys where possible) */
export const mrfHoldingTags: Record<string, HoldingTag> = {
  // ── 中国大陆 ──
  "中国建设银行股份有限公司": { 地域: "中国大陆", 主题: ["高股息"] },
  "中国建设银行股份有限公司－H": { 地域: "中国大陆", 主题: ["高股息"] },
  "中国工商银行股份有限公司－H": { 地域: "中国大陆", 主题: ["高股息", "现金奶牛"] },
  "中国电信股份有限公司": { 地域: "中国大陆", 主题: ["高股息"] },
  "中国移动有限公司": { 地域: "中国大陆", 主题: ["高股息", "现金奶牛"] },
  "中国移动有限公司－H": { 地域: "中国大陆", 主题: ["高股息", "现金奶牛"] },
  "招商银行股份有限公司": { 地域: "中国大陆", 主题: ["高股息", "现金奶牛"] },
  "中国建筑国际集团有限公司": { 地域: "中国大陆", 主题: ["HALO"] },
  "宁德时代新能源科技股份": { 地域: "中国大陆", 主题: ["科技"] },
  "紫金矿业集团股份有限公司": { 地域: "中国大陆", 主题: ["HALO"] },
  "Midea Group": { 地域: "中国大陆", 主题: ["高股息"] },
  "Zhongji Innolight": { 地域: "中国大陆", 主题: ["AI硬件", "科技"] },
  "Sungrow Power Supply": { 地域: "中国大陆", 主题: ["科技", "HALO"] },
  "中国光大环境集团有限公司": { 地域: "中国大陆", 主题: ["HALO"] },
  "上海实业环境控股有限公司": { 地域: "中国大陆", 主题: ["HALO"] },

  // ── 中国香港 ──
  "Tencent Holdings": { 地域: "中国香港", 主题: ["AI软件", "高股息", "垄断龙头"] },
  "Tencent Holdings Ltd": { 地域: "中国香港", 主题: ["AI软件", "高股息", "垄断龙头"] },
  "腾讯控股有限公司": { 地域: "中国香港", 主题: ["AI软件", "高股息", "垄断龙头"] },
  "AIA Group": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "友邦保险控股有限公司": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "Hong Kong Exchanges & Clearing": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "香港交易及结算所有限公司": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "香港电讯信托与香港电讯": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "汇丰控股有限公司 9.0% 通讯服务": { 地域: "中国香港", 主题: ["高股息", "现金奶牛"] },
  "Alibaba Group Holding": { 地域: "中国香港", 主题: ["AI软件", "科技"] },
  "阿里巴巴集团控股有限公司": { 地域: "中国香港", 主题: ["AI软件", "科技"] },
  "美团－B类别": { 地域: "中国香港", 主题: ["科技", "宏观成长"] },
  "小米集團－B類別": { 地域: "中国香港", 主题: ["科技", "AI硬件", "宏观成长"] },
  "Futu Holdings": { 地域: "中国香港", 主题: ["科技"] },
  "远东宏信有限公司": { 地域: "中国香港", 债券: "亚洲债" },

  // ── 中国台湾 ──
  "TAIWAN SEMICOND MANUFG -TSMC": { 地域: "中国台湾", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "Taiwan Semiconductor": { 地域: "中国台湾", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "台湾积体电路制造股份有限公司": { 地域: "中国台湾", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "Taiwan Semiconductor Manufac": { 地域: "中国台湾", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "MediaTek": { 地域: "中国台湾", 主题: ["AI硬件", "科技"] },
  "台光电子材料股份有限公司": { 地域: "中国台湾", 主题: ["AI硬件"] },

  // ── 日本 ──
  "Sony Group": { 地域: "日本", 主题: ["科技", "高股息"] },
  "Nintendo": { 地域: "日本", 主题: ["科技"] },
  "FAST RETAILING": { 地域: "日本", 主题: ["高股息"] },
  "HOYA": { 地域: "日本", 主题: ["科技", "AI硬件"] },

  // ── 韩国 ──
  "Samsung Electronics": { 地域: "韩国", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "SAMSUNG ELECTRONICS CO LTD": { 地域: "韩国", 主题: ["AI硬件", "高股息", "垄断龙头"] },
  "SK hynix": { 地域: "韩国", 主题: ["AI硬件"] },
  "Sk Hynix Inc": { 地域: "韩国", 主题: ["AI硬件"] },
  "Hyundai Motor Co": { 地域: "韩国", 主题: ["高股息"] },

  // ── 美国 (其他) - AI/科技主题 ──
  "NVIDIA CORP": { 地域: "其他", 主题: ["AI硬件", "科技", "垄断龙头"] },
  "Nvidia Corp": { 地域: "其他", 主题: ["AI硬件", "科技", "垄断龙头"] },
  "英伟达": { 地域: "其他", 主题: ["AI硬件", "科技", "垄断龙头"] },
  "MICROSOFT CORP": { 地域: "其他", 主题: ["AI软件", "科技", "高股息", "垄断龙头"] },
  "微软": { 地域: "其他", 主题: ["AI软件", "科技", "高股息", "垄断龙头"] },
  "ADVANCED MICRO DEVICES INC": { 地域: "其他", 主题: ["AI硬件", "科技", "宏观成长"] },
  "ALPHABET INC": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "ALPHABET INC-CL A": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "ALPHABET INC-CL C": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "Alphabet Inc (Class A)": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "Alphabet Inc (Class C)": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "Alphabet Inc-Cl A": { 地域: "其他", 主题: ["AI软件", "科技", "垄断龙头"] },
  "AMAZON COM INC": { 地域: "其他", 主题: ["AI软件", "科技", "宏观成长"] },
  "AMAZON.COM INC": { 地域: "其他", 主题: ["AI软件", "科技", "宏观成长"] },
  "亚马逊公司": { 地域: "其他", 主题: ["AI软件", "科技", "宏观成长"] },
  "APPLE INC": { 地域: "其他", 主题: ["科技", "高股息", "垄断龙头"] },
  "Apple Inc": { 地域: "其他", 主题: ["科技", "高股息", "垄断龙头"] },
  "苹果公司": { 地域: "其他", 主题: ["科技", "高股息", "垄断龙头"] },
  "BROADCOM INC": { 地域: "其他", 主题: ["AI硬件", "科技", "垄断龙头"] },
  "ROCKWELL AUTOMATION INC": { 地域: "其他", 主题: ["科技"] },
  "VISA INC": { 地域: "其他", 主题: ["高股息"] },
  "WELLS FARGO & CO": { 地域: "其他", 主题: ["高股息"] },
  "摩根大通": { 地域: "其他", 主题: ["高股息"] },
  "HDFC Bank": { 地域: "其他", 主题: ["高股息"] },
  "阿斯麦控股公司": { 地域: "其他", 主题: ["AI硬件", "科技", "垄断龙头"] },

  // ── 债券 ──
  // 投资级别债 (IG: US Treasuries, Germany, Australia, Singapore, Spain, UK)
  "US TSY 2.75% 08/32": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 2.375% 02/42": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 3.5% 01/30": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 4.25% 08/35": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 1.125% 05/40": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 2.875% 08/28": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 3.875% 08/34": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 4.125% 08/44": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 4.125% 11/29": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 4.125% 11/32": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "US TSY 5% 5/37": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "DBR 2.3% 02/33 TWIN": { 债券: "投资级别债" },
  "DBR 0% 02/32": { 债券: "投资级别债" },
  "DBR 2.5% 02/35 TWIN": { 债券: "投资级别债" },
  "AUSTRALIA 3% 11/33 166": { 债券: "投资级别债" },
  "SIGB 2.625% 08/32": { 债券: "投资级别债" },
  "SPAIN 3.45% 10/34": { 债券: "投资级别债" },
  "UK TSY 4.125% 07/29": { 债券: "投资级别债" },
  "CGB 2.48% 04/27 INBK": { 债券: "投资级别债" },
  // 意大利国债 (BTPS) - IG but peripheral
  "BTPS 2.25% 01/09/36": { 债券: "投资级别债" },
  "BTPS 0.95% 06/32 10Y": { 债券: "投资级别债" },
  "BTPS 3.65% 08/35 10Y": { 债券: "投资级别债" },

  // 亚洲债
  "菲律宾国际债券 4.50% 14/07/2028": { 债券: "亚洲债" },
  "Studio城市金融有限公司 5.00% 15/01/2029": { 债券: "亚洲债" },

  // 垃圾债 (HY: Indian corporates, infrastructure bonds)
  "Biocon Biologics 6.67% 09/10/2029": { 债券: "垃圾债" },
  "Greenko Wind Projects Maurit 7.25% 27/09/2028": { 债券: "垃圾债" },
  "IRB Infrastructure Developer 7.11% 11/03/2032": { 债券: "垃圾债" },
  "JSW钢铁有限公司 5.05% 05/04/2032": { 债券: "垃圾债", 主题: ["HALO"] },
  "Piramal Finance 7.80% 29/01/2028": { 债券: "垃圾债" },
  "Sammaan Capital 7.50% 16/10/2030": { 债券: "垃圾债" },
  "Shriram Finance Ltd. 6.15% 03/04/2028": { 债券: "垃圾债" },
  "镍业有限公司 9.00% 30/09/2030": { 债券: "垃圾债", 主题: ["HALO"] },
  "MBONO 7.5% 05/33 M": { 债券: "垃圾债" },

  // ── 披露常见英文全称 / 代码（与 mrfHoldingNameUnified 别名一致）──
  "CHINA CONSTRUCTION BANK CORP H": { 地域: "中国大陆", 主题: ["高股息"] },
  "HON HAI PRECISION INDUSTRY LTD": { 地域: "中国台湾", 主题: ["科技"] },
  "DBS GROUP HOLDINGS LTD": { 地域: "其他", 主题: ["高股息"] },
  "BANK NEGARA INDONESIA PERSERO TBK AT1-P 4.3": { 债券: "垃圾债" },
  "SUMITOMO LIFE INSURANCE CO PERP 5.875": { 债券: "投资级别债" },
  "MEIJI YASUDA LIFE INSURANCE CO HYBRID 5.8": { 债券: "投资级别债" },
  "WYNN MACAU LTD 5.5 01-OCT-2027": { 债券: "亚洲债" },
  "WOORI BANK AT1-P 6.375 31-DEC-2079": { 债券: "投资级别债" },
  "US Department of The Treasury 3.88% 2030.06.30": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "United Kingdom of Great Britain 4.50% 2035.03.07": { 债券: "投资级别债" },
  "Republic of Italy 3.65% 2035.08.01": { 债券: "投资级别债" },
  "French Republic 3.50% 2035.11.25": { 债券: "投资级别债" },
  "US Department of The Treasury 3.63% 2030.10.31": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "People's Republic of China 2.04% 2034.11.25": { 债券: "投资级别债" },
  "Government of Japan 2.30% 2054.12.20": { 债券: "投资级别债" },
  "Italy Buoni Poliennali Del Tesoro 4.30% 2054.10.01": { 债券: "投资级别债" },
  "Secretaria General Del Tesoro 4.00% 2054.10.31": { 债券: "投资级别债" },
  "US Department of The Treasury 4.25% 2035.05.15": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "Her Majesty The Queen In Right of New Zealand 4.5% 2030.05.15": { 债券: "投资级别债" },
  "US Department of The Treasury 1.875% 2035.07.15": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "HDFC Bank Limited 3.7% 2075.11.30": { 地域: "其他", 主题: ["高股息"] },
  "Krung Thai Bank Pcl 4.4% 2075.11.30": { 债券: "亚洲债" },
  "Republic of The Philippines 5.95% 2047.10.13": { 债券: "亚洲债" },
  "Meituan 0% 2028.04.27": { 债券: "亚洲债" },
  "PT Bank Negara Indonesia 4.3% 2049.12.31": { 债券: "亚洲债" },
  "PT Freeport Indonesia 5.315% 2032.04.14": { 债券: "垃圾债" },
  "Tata Capital Ltd 5.389% 2028.07.21": { 债券: "垃圾债" },
  "Studio City Finance Limited 5% 2029.01.15": { 债券: "亚洲债" },
  "Us Treasury N/B 4.125% 15.11.2032 Uns": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "Us Treasury N/B 4.25% 31.12.2026 Uns": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "Us Treasury N/B 4% 31.01.2029 Uns": { 债券: "投资级别债", 主题: ["利率锚定"] },
  "Meta平台股份有限公司": { 地域: "其他", 主题: ["科技", "AI软件", "宏观成长"] },
  "Telstra Group": { 地域: "其他", 主题: ["高股息"] },
  "Invesco Physical Gold Etc": { 地域: "其他", 主题: ["通胀避险"] },
  "VANGUARD S&P 500 ETF 8.6% 能源相关": { 地域: "其他", 主题: ["科技"] },
  "ISHARES MSCI EMERGING MARKETS ASIA ETF 4.9% 通讯服务": { 地域: "其他", 主题: ["科技"] },
  "中银保诚日本中小企业机遇基金": { 地域: "日本", 主题: ["科技"] },
};

export type HoldingRowLike = {
  holding_name_std: string;
  holding_name_raw: string | null;
};

function holdingKey(h: HoldingRowLike): string {
  return (h.holding_name_std || h.holding_name_raw || "").trim();
}

/** 按统一规则解析标签（别名 + 繁简 + 原串） */
export function getMrfHoldingTagForRawName(raw: string): HoldingTag | undefined {
  const t = (raw || "").trim();
  if (!t) return undefined;
  return (
    mrfHoldingTags[t] ??
    mrfHoldingTags[resolveMrfHoldingTagLookupKey(t)] ??
    mrfHoldingTags[tradToSimplifiedHoldingName(t)]
  );
}

/** 若未选任何标签维度，视为全部匹配；否则需底层持仓命中 mrfHoldingTags，且各已选维度之间为 AND。 */
export function fundMatchesHoldingTagFilters(
  holdings: HoldingRowLike[] | undefined,
  region: MrfRegionOption,
  theme: MrfThemeOption,
  bond: MrfBondOption
): boolean {
  const activeR = region !== "全部";
  const activeT = theme !== "全部";
  const activeB = bond !== "全部";
  if (!activeR && !activeT && !activeB) return true;
  if (!holdings?.length) return false;

  if (activeR) {
    const ok = holdings.some((h) => getMrfHoldingTagForRawName(holdingKey(h))?.地域 === region);
    if (!ok) return false;
  }
  if (activeT) {
    const ok = holdings.some((h) => {
      const themes = getMrfHoldingTagForRawName(holdingKey(h))?.主题;
      return themes?.includes(theme as NonNullable<HoldingTag["主题"]>[number]) ?? false;
    });
    if (!ok) return false;
  }
  if (activeB) {
    const ok = holdings.some((h) => getMrfHoldingTagForRawName(holdingKey(h))?.债券 === bond);
    if (!ok) return false;
  }
  return true;
}
