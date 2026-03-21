/**
 * Generate realistic options chain from spot price + IV.
 * IV base 40%, skew +2% per 10 points OTM. Strikes: spot ± 5,10,15,20,25,30.
 * Greeks via Black-Scholes. Default DTE 31 (next monthly).
 */

import type { OptionsContract } from "@/types";
import {
  calcOptionPrice,
  calcDelta,
  calcTheta,
  calcGamma,
} from "./blackScholes";

const DEFAULT_DTE = 31;
const BASE_IV = 0.4;
const SKEW_PER_10_OTM = 0.02;

function ivForStrike(spot: number, strike: number, type: "call" | "put"): number {
  const otm = type === "call" ? Math.max(0, strike - spot) : Math.max(0, spot - strike);
  return BASE_IV + (otm / 10) * SKEW_PER_10_OTM;
}

function nextMonthlyExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setDate(0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = d.getDate();
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

export function generateOptionsChain(
  spot: number,
  dte: number = DEFAULT_DTE,
  expiry?: string
): OptionsContract[] {
  const exp = expiry || nextMonthlyExpiry();
  const strikes: number[] = [];
  for (let d = -30; d <= 30; d += 5) {
    const s = Math.round((spot + d) / 5) * 5;
    if (s > 0 && !strikes.includes(s)) strikes.push(s);
  }
  strikes.sort((a, b) => a - b);

  const contracts: OptionsContract[] = [];
  for (const strike of strikes) {
    const ivCall = ivForStrike(spot, strike, "call");
    const ivPut = ivForStrike(spot, strike, "put");
    const callPrice = calcOptionPrice("call", spot, strike, ivCall, dte);
    const putPrice = calcOptionPrice("put", spot, strike, ivPut, dte);
    const spread = 0.05 * (callPrice + 1);
    contracts.push({
      strike,
      expiry: exp,
      type: "call",
      bid: Math.max(0.01, callPrice - spread / 2),
      ask: callPrice + spread / 2,
      iv: ivCall,
      delta: calcDelta(spot, strike, ivCall, dte, "call"),
      theta: calcTheta(spot, strike, ivCall, dte, "call"),
      gamma: calcGamma(spot, strike, ivCall, dte),
    });
    contracts.push({
      strike,
      expiry: exp,
      type: "put",
      bid: Math.max(0.01, putPrice - spread / 2),
      ask: putPrice + spread / 2,
      iv: ivPut,
      delta: calcDelta(spot, strike, ivPut, dte, "put"),
      theta: calcTheta(spot, strike, ivPut, dte, "put"),
      gamma: calcGamma(spot, strike, ivPut, dte),
    });
  }
  return contracts;
}
