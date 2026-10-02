import raw from "./public-us-strategy.json";

export type TrackStats = {
  key: string;
  label: string;
  tagline: string;
  signals: number;
  winRate: number;
  alphaWinRate: number;
  avg4Q: number;
  avgAlpha: number;
};

export type YearlyRow = {
  year: number;
  aSignals: number;
  aAvg4Q: number;
  aAlpha: number;
  aAlphaWin: number;
  bSignals: number;
  bAvg4Q: number;
  bAlpha: number;
  bAlphaWin: number;
  spyReturn: number;
};

export type UsStrategyData = {
  meta: {
    name: string;
    quarter: string;
    dataNote: string;
    disclaimer: string;
  };
  tracks: { A: TrackStats; B: TrackStats };
  yearly: YearlyRow[];
  downYear: YearlyRow;
  quarterHighlights: { title: string; text: string }[];
  source: string;
};

export const US_STRATEGY = raw as unknown as UsStrategyData;
