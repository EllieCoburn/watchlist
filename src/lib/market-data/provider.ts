import "server-only";

import { getMarketDataProvider } from "./providers";
import { alignSeriesToQuote, computeRangeStats, type RangeStats } from "./range-stats";
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
  /** Change and low/high for the requested range, per symbol. */
  rangeStats: Record<string, RangeStats>;
  range: TimeRange;
  status: MarketStatus;
  dataLabel: string;
  /** True when the series is modeled rather than market data. */
  historyModeled: boolean;
  /**
   * True when real quotes sit on top of modeled history (e.g. Finnhub free tier). Range
   * figures beyond today would then mix real and modeled numbers, so the cards keep today's
   * change and low/high for every range and say so.
   */
  rangeFiguresUnavailable: boolean;
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
  const rangeFiguresUnavailable = provider.historyModeled && provider.id !== "mock";
  const series: Record<string, number[]> = {};
  const rangeStats: Record<string, RangeStats> = {};
  unique.forEach((s, i) => {
    const q = quoteMap[s];
    const points = q ? alignSeriesToQuote(seriesList[i], q) : seriesList[i];
    series[s] = points.map((p) => p.price);
    if (q) rangeStats[s] = computeRangeStats(q, points, rangeFiguresUnavailable ? "1D" : range);
  });
  return {
    quotes: quoteMap,
    series,
    rangeStats,
    range,
    status,
    dataLabel: provider.dataLabel,
    historyModeled: provider.historyModeled,
    rangeFiguresUnavailable,
    asOf: Date.now(),
  };
}
