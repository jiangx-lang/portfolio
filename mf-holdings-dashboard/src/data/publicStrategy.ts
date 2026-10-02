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
  cagrBug: number | string | null;
  status: string;
};

export type CorrectionNote = {
  date: string;
  title: string;
  bug: string;
  impact: string;
  flips: { title: string; text: string }[];
};

export type PublicStrategyData = {
  meta: {
    name: string;
    asof: string;
    dataEnd: string;
    backtestStart: string;
    correctedOn: string;
    disclaimer: string;
  };
  correction: CorrectionNote;
  active: {
    gridKey: string;
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    calmar: number;
    multiple: number;
    note: string;
  };
  monthlyRef: {
    label: string;
    cagr: number;
    sharpe: number;
    maxDD: number;
    multiple: number;
  };
  mainChart: {
    dates: string[];
    active: (number | null)[];
    monthlyRef: (number | null)[];
    benchmark: (number | null)[];
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
    activeKey: string;
    championKey: string;
  };
  monthly: Record<string, Record<string, number | null>>;
  versions: VersionRow[];
  riskExtra: string[];
  source: string;
};

export const STRATEGY = raw as unknown as PublicStrategyData;

export const pct = (v: number | null | undefined, digits = 1): string =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2): string =>
  v == null ? "—" : v.toFixed(digits);

export const cellOf = (n: number, w: number): GridCell =>
  STRATEGY.grid.cells.find((c) => c.n === n && c.w === w)!;
