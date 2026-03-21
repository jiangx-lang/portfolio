/**
 * Public.com MCP / API wrapper.
 * When PUBLICCOM_API_KEY is missing: use Yahoo Finance (yahoo-finance2) for quote/IV, mock for options.
 */

import type { Holding, OptionsContract, IVStats } from "@/types";
import {
  MOCK_HOLDINGS,
  mockOptionsChain,
  mockIVStats,
} from "./mockData";
import { fetchQuote, fetchIVStats } from "./yahoo";

export async function getQuote(ticker: string): Promise<{
  price: number;
  change: number;
  volume: number;
}> {
  if (process.env.PUBLICCOM_API_KEY) {
    // TODO: call Public.com API
  }
  const q = await fetchQuote(ticker);
  return { price: q.price, change: q.change, volume: q.volume };
}

export async function getOptionsChain(
  ticker: string,
  expiry: string,
  spotPrice: number
): Promise<OptionsContract[]> {
  if (!process.env.PUBLICCOM_API_KEY) {
    return mockOptionsChain(ticker, spotPrice);
  }
  // TODO: call Public.com API
  return mockOptionsChain(ticker, spotPrice);
}

export async function getPortfolioPositions(): Promise<Holding[]> {
  if (!process.env.PUBLICCOM_API_KEY) {
    return MOCK_HOLDINGS;
  }
  // TODO: call Public.com API getPortfolioPositions()
  return MOCK_HOLDINGS;
}

export async function getIVStats(ticker: string): Promise<IVStats> {
  if (process.env.PUBLICCOM_API_KEY) {
    // TODO: call Public.com API
  }
  return fetchIVStats(ticker);
}
