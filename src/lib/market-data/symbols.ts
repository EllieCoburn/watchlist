import type { SymbolMatch } from "./types";

/**
 * Small directory used by the mock provider for company names and realistic base prices.
 * Unknown tickers still work (a deterministic price is derived from the symbol) but show no name.
 */
export type SymbolInfo = SymbolMatch & { basePrice: number; volatility: number };

export const SYMBOL_DIRECTORY: SymbolInfo[] = [
  { symbol: "AAPL", companyName: "Apple Inc", basePrice: 336, volatility: 0.016 },
  { symbol: "MSFT", companyName: "Microsoft Corp", basePrice: 494, volatility: 0.014 },
  { symbol: "NVDA", companyName: "NVIDIA Corp", basePrice: 222, volatility: 0.028 },
  { symbol: "AMZN", companyName: "Amazon.com Inc", basePrice: 248, volatility: 0.02 },
  { symbol: "GOOGL", companyName: "Alphabet Inc", basePrice: 236, volatility: 0.018 },
  { symbol: "META", companyName: "Meta Platforms Inc", basePrice: 742, volatility: 0.022 },
  { symbol: "TSLA", companyName: "Tesla Inc", basePrice: 412, volatility: 0.035 },
  { symbol: "PLTR", companyName: "Palantir Technologies", basePrice: 175, volatility: 0.038 },
  { symbol: "AMD", companyName: "Advanced Micro Devices", basePrice: 168, volatility: 0.03 },
  { symbol: "NFLX", companyName: "Netflix Inc", basePrice: 1210, volatility: 0.02 },
  { symbol: "AVGO", companyName: "Broadcom Inc", basePrice: 356, volatility: 0.024 },
  { symbol: "COST", companyName: "Costco Wholesale", basePrice: 948, volatility: 0.012 },
  { symbol: "JPM", companyName: "JPMorgan Chase & Co", basePrice: 312, volatility: 0.014 },
  { symbol: "V", companyName: "Visa Inc", basePrice: 352, volatility: 0.012 },
  { symbol: "MA", companyName: "Mastercard Inc", basePrice: 590, volatility: 0.012 },
  { symbol: "BRK.B", companyName: "Berkshire Hathaway", basePrice: 498, volatility: 0.01 },
  { symbol: "UNH", companyName: "UnitedHealth Group", basePrice: 342, volatility: 0.02 },
  { symbol: "JNJ", companyName: "Johnson & Johnson", basePrice: 172, volatility: 0.01 },
  { symbol: "LLY", companyName: "Eli Lilly and Co", basePrice: 812, volatility: 0.02 },
  { symbol: "XOM", companyName: "Exxon Mobil Corp", basePrice: 118, volatility: 0.014 },
  { symbol: "CVX", companyName: "Chevron Corp", basePrice: 162, volatility: 0.014 },
  { symbol: "WMT", companyName: "Walmart Inc", basePrice: 104, volatility: 0.011 },
  { symbol: "HD", companyName: "Home Depot Inc", basePrice: 418, volatility: 0.013 },
  { symbol: "PG", companyName: "Procter & Gamble", basePrice: 158, volatility: 0.009 },
  { symbol: "KO", companyName: "Coca-Cola Co", basePrice: 71, volatility: 0.009 },
  { symbol: "PEP", companyName: "PepsiCo Inc", basePrice: 146, volatility: 0.01 },
  { symbol: "DIS", companyName: "Walt Disney Co", basePrice: 118, volatility: 0.018 },
  { symbol: "NKE", companyName: "Nike Inc", basePrice: 78, volatility: 0.02 },
  { symbol: "SBUX", companyName: "Starbucks Corp", basePrice: 92, volatility: 0.018 },
  { symbol: "MCD", companyName: "McDonald's Corp", basePrice: 306, volatility: 0.01 },
  { symbol: "BA", companyName: "Boeing Co", basePrice: 224, volatility: 0.024 },
  { symbol: "CAT", companyName: "Caterpillar Inc", basePrice: 438, volatility: 0.016 },
  { symbol: "GE", companyName: "GE Aerospace", basePrice: 296, volatility: 0.018 },
  { symbol: "INTC", companyName: "Intel Corp", basePrice: 34, volatility: 0.03 },
  { symbol: "CRM", companyName: "Salesforce Inc", basePrice: 262, volatility: 0.02 },
  { symbol: "ORCL", companyName: "Oracle Corp", basePrice: 298, volatility: 0.024 },
  { symbol: "ADBE", companyName: "Adobe Inc", basePrice: 352, volatility: 0.02 },
  { symbol: "SHOP", companyName: "Shopify Inc", basePrice: 148, volatility: 0.03 },
  { symbol: "UBER", companyName: "Uber Technologies", basePrice: 96, volatility: 0.024 },
  { symbol: "ABNB", companyName: "Airbnb Inc", basePrice: 132, volatility: 0.022 },
  { symbol: "COIN", companyName: "Coinbase Global", basePrice: 318, volatility: 0.045 },
  { symbol: "SQ", companyName: "Block Inc", basePrice: 74, volatility: 0.032 },
  { symbol: "PYPL", companyName: "PayPal Holdings", basePrice: 72, volatility: 0.022 },
  { symbol: "SOFI", companyName: "SoFi Technologies", basePrice: 24, volatility: 0.04 },
  { symbol: "RIVN", companyName: "Rivian Automotive", basePrice: 15, volatility: 0.045 },
  { symbol: "SPY", companyName: "SPDR S&P 500 ETF", basePrice: 668, volatility: 0.009 },
  { symbol: "QQQ", companyName: "Invesco QQQ Trust", basePrice: 604, volatility: 0.012 },
  {
    symbol: "VTI",
    companyName: "Vanguard Total Stock Market ETF",
    basePrice: 328,
    volatility: 0.009,
  },
  { symbol: "IWM", companyName: "iShares Russell 2000 ETF", basePrice: 246, volatility: 0.014 },
  { symbol: "GLD", companyName: "SPDR Gold Shares", basePrice: 342, volatility: 0.008 },
];

const BY_SYMBOL = new Map(SYMBOL_DIRECTORY.map((s) => [s.symbol, s]));

export function findSymbol(symbol: string): SymbolInfo | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function searchDirectory(query: string, limit = 8): SymbolMatch[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const starts: SymbolMatch[] = [];
  const contains: SymbolMatch[] = [];
  for (const s of SYMBOL_DIRECTORY) {
    if (s.symbol.startsWith(q)) starts.push({ symbol: s.symbol, companyName: s.companyName });
    else if (s.symbol.includes(q) || s.companyName.toUpperCase().includes(q))
      contains.push({ symbol: s.symbol, companyName: s.companyName });
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Ticker rules: 1–10 characters, uppercase letters, digits, dot or hyphen (e.g. BRK.B). */
export const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/;

export function normalizeTicker(input: string): string | null {
  const t = input.trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}
