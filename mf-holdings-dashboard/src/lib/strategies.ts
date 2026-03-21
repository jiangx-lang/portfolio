/**
 * Strategy cards: given spot + IV Rank, auto-recommend and compute payoff metrics.
 * IV Rank < 30 → debit; 30–50 → neutral; > 50 → credit.
 */

import type { StrategyCard } from "@/types";
import { calcOptionPrice } from "./blackScholes";

const DTE_30 = 30;
const DTE_45 = 45;
const DTE_365 = 365;

export function getRecommendedStrategyId(ivRank: number): string {
  if (ivRank < 30) return "leap_call";
  if (ivRank > 50) return "cash_secured_put";
  return "bull_call_spread";
}

export function buildStrategyCards(
  spot: number,
  ivRank: number,
  iv30d: number
): StrategyCard[] {
  const atm = Math.round(spot / 5) * 5;
  const otm8 = Math.round((spot * 1.08) / 5) * 5;
  const otm5 = Math.round((spot * 0.95) / 5) * 5;
  const itm65 = Math.round((spot * 0.85) / 5) * 5;
  const otm8Put = Math.round((spot * 0.92) / 5) * 5;

  const callAtm = calcOptionPrice("call", spot, atm, iv30d, DTE_30);
  const callOtm8 = calcOptionPrice("call", spot, otm8, iv30d, DTE_30);
  const putOtm5 = calcOptionPrice("put", spot, otm5, iv30d, DTE_45);
  const callLeap = calcOptionPrice("call", spot, itm65, iv30d * 0.9, DTE_365);
  const putAtm = calcOptionPrice("put", spot, atm, iv30d, DTE_30);
  const putOtm8 = calcOptionPrice("put", spot, otm8Put, iv30d, DTE_30);

  const spreadCost = Math.max(0.1, callAtm - callOtm8);
  const pop = 0.55 + (ivRank / 100) * 0.2;

  const cards: StrategyCard[] = [
    {
      id: "bull_call_spread",
      name: "Bull Call Spread",
      maxProfit: (otm8 - atm - spreadCost) * 100,
      maxLoss: spreadCost * 100,
      breakeven: atm + spreadCost,
      probabilityOfProfit: pop,
      strikes: { buy: atm, sell: otm8 },
      expiry: "30d",
    },
    {
      id: "leap_call",
      name: "LEAP Call",
      maxProfit: Number.POSITIVE_INFINITY,
      maxLoss: callLeap * 100,
      breakeven: itm65 + callLeap,
      probabilityOfProfit: 0.65,
      strikes: { buy: itm65 },
      expiry: "12mo",
    },
    {
      id: "cash_secured_put",
      name: "Cash-Secured Put",
      maxProfit: putOtm5 * 100,
      maxLoss: (otm5 - spot) * 100 + putOtm5 * 100,
      breakeven: otm5 - putOtm5,
      probabilityOfProfit: pop,
      strikes: { sell: otm5 },
      expiry: "30-45 DTE",
    },
    {
      id: "covered_call",
      name: "Covered Call",
      maxProfit: (otm8 - spot) * 100 + callOtm8 * 100,
      maxLoss: (spot - 0) * 100 - callOtm8 * 100,
      breakeven: spot - callOtm8,
      probabilityOfProfit: 0.6,
      strikes: { sell: otm8 },
      expiry: "30d",
    },
    {
      id: "put_debit_spread",
      name: "Put Debit Spread",
      maxProfit: (atm - otm8Put - (putAtm - putOtm8)) * 100,
      maxLoss: (putAtm - putOtm8) * 100,
      breakeven: atm - (putAtm - putOtm8),
      probabilityOfProfit: 1 - pop,
      strikes: { buy: atm, sell: otm8Put },
      expiry: "30d",
    },
    {
      id: "diagonal",
      name: "Diagonal Spread",
      maxProfit: 500,
      maxLoss: callLeap * 100 * 0.7,
      breakeven: itm65 + callLeap * 0.5,
      probabilityOfProfit: 0.58,
      strikes: { buy: itm65, sell: otm8 },
      expiry: "12mo / 30d",
    },
  ];

  return cards;
}
