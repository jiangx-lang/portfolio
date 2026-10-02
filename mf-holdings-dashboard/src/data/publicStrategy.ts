import raw from "./public-strategy.json";

export type RootStrategyData = {
  meta: {
    name: string;
    asof: string;
    dataEnd: string;
    backtestStart: string;
    updatedOn: string;
    disclaimer: string;
  };
  root: {
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    finalNav: number;
    multiple: number;
    nTrades: number;
  };
  definition: string[];
  mainChart: {
    dates: string[];
    root: (number | null)[];
    benchmark: (number | null)[];
    ddRoot: (number | null)[];
    ddBenchmark: (number | null)[];
  };
  sources: {
    entry: {
      shareBuys: number;
      contribShare: number;
      winRate: number;
      text: string;
    };
    exit: {
      tpN: number;
      tpPnlWan: number;
      tpWin: number;
      decayN: number;
      decayPnlWan: number;
      text: string;
    };
    eras: { y2025: number; y2026: number; text: string };
  };
  verification: string;
  risks: string[];
  source: string;
};

export const STRATEGY = raw as unknown as RootStrategyData;

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2): string =>
  v == null ? "—" : v.toFixed(digits);
