/**
 * 美股 ticker 判断：
 * - 之前只对白名单（Top10）开放，导致点击其它美股（WM/MCD/CTVA...）被误判为 QDII → 404。
 * - 现在改为：白名单优先 + “纯股票 ticker 形态”兜底（不含 .HK/.TW 等后缀，不是基金代码）。
 */
export const US_STOCK_TICKERS = ["NVDA", "MSFT", "AAPL", "GOOGL", "META", "AVGO", "AMZN", "TSLA", "AMAT", "CRM"];

function looksLikeUsTicker(t: string): boolean {
  const s = (t || "").trim().toUpperCase();
  if (!s) return false;
  if (s.includes(".")) return false; // 排除 0700.HK / 2454.TW / 000660.KS 等
  if (/^\d/.test(s)) return false; // 排除纯数字类代码
  if (/^(QDUR|QDUT)\d+/.test(s)) return false; // 排除 QD 基金代码
  // 常见美股形态：1-6 位字母，允许 BRK-B 这种带一段 -X
  return /^[A-Z]{1,6}(-[A-Z])?$/.test(s);
}

export function isUsStock(ticker: string): boolean {
  const t = (ticker || "").trim().toUpperCase();
  return US_STOCK_TICKERS.includes(t) || looksLikeUsTicker(t);
}
