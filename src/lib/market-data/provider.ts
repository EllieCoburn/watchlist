import "server-only";

import { getMarketDataProvider } from "./providers";
import type { MarketStatus, PricePoint, Quote, SymbolMatch, TimeRange } from "./types";

/**
 * The only market-data entry point the rest of the app uses. Server-only so provider
 * secrets never reach the browser; client components go through /api/market/*.
 */
export function getQuote(symbol: string): Promise<Quote> {
  return getMarketDataProvider().getQuote(symbol);
}

export function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return Promise.resolve([]);
  return getMarketDataProvider().getQuotes(symbols);
}

export function getHistoricalPrices(symbol: string, range: TimeRange): Promise<PricePoint[]> {
  return getMarketDataProvider().getHistoricalPrices(symbol, range);
}

export function getPricesBetween(
  symbol: string,
  fromMs: number,
  toMs: number,
): Promise<PricePoint[]> {
  return getMarketDataProvider().getPricesBetween(symbol, fromMs, toMs);
}

export function getMarketStatus(): Promise<MarketStatus> {
  return getMarketDataProvider().getMarketStatus();
}

export function searchSymbols(query: string): Promise<SymbolMatch[]> {
  return getMarketDataProvider().searchSymbols(query);
}

export function lookupSymbol(symbol: string): Promise<SymbolMatch | null> {
  return getMarketDataProvider().lookupSymbol(symbol);
}

export function getDataLabel(): string {
  return getMarketDataProvider().dataLabel;
}

export type WatchSnapshot = {
  quotes: Record<string, Quote>;
  series: Record<string, number[]>;
  status: MarketStatus;
  dataLabel: string;
  asOf: number;
};

/** Everything the Watch dashboard needs for a set of symbols in one call. */
export async function getWatchSnapshot(
  symbols: string[],
  range: TimeRange,
): Promise<WatchSnapshot> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const provider = getMarketDataProvider();
  const [quotes, status, seriesList] = await Promise.all([
    unique.length ? provider.getQuotes(unique) : Promise.resolve([]),
    provider.getMarketStatus(),
    Promise.all(unique.map((s) => provider.getHistoricalPrices(s, range))),
  ]);
  const quoteMap: Record<string, Quote> = {};
  for (const q of quotes) quoteMap[q.symbol] = q;
  const series: Record<string, number[]> = {};
  unique.forEach((s, i) => {
    series[s] = seriesList[i].map((p) => p.price);
  });
  return { quotes: quoteMap, series, status, dataLabel: provider.dataLabel, asOf: Date.now() };
}
