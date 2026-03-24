// MF Holdings Dashboard — Data models

export type { FundPerformance } from "./fund";

export type SignalLevel =
  | "strong_buy"
  | "buy"
  | "hold"
  | "trim"
  | "sell";

export interface Holding {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  price: number;
  change: number;
  changePercent: number;
  pe: number | null;
  ytd: number;
  beta: number;
  high52: number;
  low52?: number;
  sharpe?: number;
  marketCap?: number;
  signal?: SignalLevel;
  thesis?: string;
  isin?: string;
  ccy?: string;
  isQDII?: boolean;
}

export interface OptionsContract {
  strike: number;
  expiry: string;
  type: "call" | "put";
  bid: number;
  ask: number;
  iv: number;
  delta: number;
  theta: number;
  gamma?: number;
}

export interface GreeksData {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

export interface StrategyCard {
  id: string;
  name: string;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  probabilityOfProfit: number;
  strikes?: { buy?: number; sell?: number };
  expiry?: string;
}

export interface AISignal {
  signal: SignalLevel;
  confidence: number;
  headline?: string;
  // 新版（面向中国普通投资者）
  whyInvest?: string;
  marketSentiment?: string;
  timingScore?: number;
  timingExplanation?: string;
  valuationVerdict?: "attractive" | "fair" | "expensive";
  valuationComment?: string;
  simpleStrategy?: {
    forConservative?: string;
    forGrowth?: string;
    optionSignal?: string;
  };
  // 兼容旧版字段
  thesis?: string;
  timing?: string;
  ivComment?: string;
  keyRisks: string[];
  catalysts: string[];
  optionsStrategy?: {
    recommended: string;
    // 兼容旧结构 + 新的客户友好结构
    rationale?: string;
    ivAssessment?: string;
    strikes?: { buy: number; sell?: number | null };
    expiry?: string;
    maxProfit?: number;
    maxLoss?: number;
    breakeven?: number;
    probabilityOfProfit?: number;

    clientFriendlyExplanation?: string;
    cost?: number;
    maxGain?: number;
    suitableFor?: string;
  };
  priceTarget?: { bull: number; base: number; bear: number; explanation?: string };
}

export interface RiskMetrics {
  ticker: string;
  beta: number;
  high52: number;
  percentFromHigh: number;
  sharpe: number;
  riskTier: "low" | "medium" | "high";
}

export interface IVStats {
  iv30d: number;
  ivRank: number;
  ivPercentile: number;
  iv52wHigh: number;
  iv52wLow: number;
  nextEarnings?: string;
}
