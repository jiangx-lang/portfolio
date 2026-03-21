/**
 * Black-Scholes approximation for options pricing and Greeks.
 * Disclaimer: approximation only — use for UI/strategy illustration, not trading.
 */

const RFR = 0.05;

function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, a6 = 0.3275911;
  const t = 1.0 / (1.0 + a6 * Math.abs(x));
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return x < 0 ? 1 - y : y;
}

function d1(spot: number, strike: number, iv: number, dte: number): number {
  const T = dte / 365;
  if (T <= 0) return strike <= spot ? 10 : -10;
  return (Math.log(spot / strike) + (RFR + (iv * iv) / 2) * T) / (iv * Math.sqrt(T));
}

function d2(spot: number, strike: number, iv: number, dte: number): number {
  const T = dte / 365;
  if (T <= 0) return strike <= spot ? 10 : -10;
  return d1(spot, strike, iv, dte) - iv * Math.sqrt(dte / 365);
}

/** Call option price (Black-Scholes) */
export function calcOptionPrice(
  type: "call" | "put",
  spot: number,
  strike: number,
  iv: number,
  dte: number
): number {
  const T = dte / 365;
  if (T <= 0) return type === "call" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const d1Val = d1(spot, strike, iv, dte);
  const d2Val = d2(spot, strike, iv, dte);
  if (type === "call") {
    return spot * normCDF(d1Val) - strike * Math.exp(-RFR * T) * normCDF(d2Val);
  }
  return strike * Math.exp(-RFR * T) * normCDF(-d2Val) - spot * normCDF(-d1Val);
}

/** Delta: call = N(d1), put = N(d1) - 1 */
export function calcDelta(
  spot: number,
  strike: number,
  iv: number,
  dte: number,
  type: "call" | "put" = "call"
): number {
  const T = dte / 365;
  if (T <= 0) return type === "call" ? (strike <= spot ? 1 : 0) : (strike <= spot ? 0 : -1);
  const d1Val = d1(spot, strike, iv, dte);
  const n = normCDF(d1Val);
  return type === "call" ? n : n - 1;
}

/** Theta (per day) — finite difference approximation */
export function calcTheta(
  spot: number,
  strike: number,
  iv: number,
  dte: number,
  type: "call" | "put" = "call"
): number {
  const h = 1;
  const p0 = calcOptionPrice(type, spot, strike, iv, dte);
  const p1 = calcOptionPrice(type, spot, strike, iv, Math.max(0, dte - h));
  return (p1 - p0) / 1;
}

/** Gamma (per $1 move) — finite difference */
export function calcGamma(spot: number, strike: number, iv: number, dte: number): number {
  const h = 0.01 * spot;
  const d0 = calcDelta(spot, strike, iv, dte, "call");
  const dUp = calcDelta(spot + h, strike, iv, dte, "call");
  return (dUp - d0) / h;
}
