import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(n: number, decimals = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

export function formatMoney(n: number, decimals = 2): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(decimals)}`;
}
