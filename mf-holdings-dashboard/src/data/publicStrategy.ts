import raw from "./public-strategy.json";

export type GridCell = {
  key: string;
  n: number;
  w: number;
  holdingLabel: string;
  weightLabel: string;
  cagr: number;
  sharpe: number;
  maxDD: number;
  calmar: number;
  multiple: number;
};

export type VersionRow = {
  version: string;
  desc: string;
  cagr: number | null;
  sharpe: number | null;
  maxDD: number | null;
  status: string;
};

export type V16GradientRow = {
  n: number;
  holdingLabel: string;
  cagr: number;
  sharpe: number;
  maxDD: number;
  calmar: number;
  multiple: number;
  nTrades: number;
  production: boolean;
};

export type V16Champion = {
  board: string;
  holdingLabel: string;
  value: number;
  fmt: "pct" | "num";
  note?: string;
};

export type V16Data = {
  label: string;
  productionN: number;
  gradient: V16GradientRow[];
  champions: V16Champion[];
  dates: string[];
  nav: Record<string, number[]>;
  v0: {
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    nTrades: number;
  };
  mechanics: { title: string; text: string }[];
  state: {
    status: string;
    poolIndex: number;
    poolMa: number;
    asof: string;
    text: string;
  };
  source: string;
};

export type PublicStrategyData = {
  meta: {
    name: string;
    asof: string;
    dataEnd: string;
    backtestStart: string;
    disclaimer: string;
  };
  active: {
    gridKey: string;
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    calmar: number;
    multiple: number;
  };
  candidate: {
    gridKey: string;
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    calmar: number;
    multiple: number;
  };
  mainChart: {
    dates: string[];
    active: (number | null)[];
    benchmark: (number | null)[];
    candidate: (number | null)[];
    ddActive: (number | null)[];
    ddBenchmark: (number | null)[];
  };
  grid: {
    ns: number[];
    ws: number[];
    holdingLabels: Record<string, string>;
    weightLabels: Record<string, string>;
    cells: GridCell[];
    dates: string[];
    nav: Record<string, number[]>;
  };
  monthly: Record<string, Record<string, number | null>>;
  versions: VersionRow[];
  v16: V16Data;
  source: string;
};

export const STRATEGY = raw as unknown as PublicStrategyData;

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2): string =>
  v == null ? "—" : v.toFixed(digits);

export const cellOf = (n: number, w: number): GridCell =>
  STRATEGY.grid.cells.find((c) => c.n === n && c.w === w)!;
