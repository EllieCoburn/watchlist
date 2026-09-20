import "server-only";

import { getMarketDataProvider } from "./providers";
import { alignSeriesToQuote, computeRangeStats, tickWindow, type RangeStats } from "./range-stats";
import type {
  DailyBars,
  IntradayHistory,
  MarketStatus,
  PricePoint,
  Quote,
  SeriesSource,
  SymbolMatch,
  TimeRange,
} from "./types";

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
  return getMarketDataProvider()
    .getHistoricalPrices(symbol, range)
    .then((s) => s.points);
}

export function getPricesBetween(
  symbol: string,
  fromMs: number,
  toMs: number,
): Promise<PricePoint[]> {
  return getMarketDataProvider().getPricesBetween(symbol, fromMs, toMs);
}

/** Real daily OHLC bars for the engine. Throws when the active provider has no real history. */
export function getDailyBars(symbol: string, count: number): Promise<DailyBars> {
  return getMarketDataProvider().getDailyBars(symbol, count);
}

/** Real regular-hours intraday bars for the engines. Throws when unavailable. */
export function getIntradayHistory(
  symbol: string,
  sessions: number,
  intervalMinutes = 5,
): Promise<IntradayHistory> {
  return getMarketDataProvider().getIntradayHistory(symbol, sessions, intervalMinutes);
}

export function getNextEarningsDate(symbol: string): Promise<string | null> {
  return getMarketDataProvider().getNextEarningsDate(symbol);
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
  /** Where each symbol's series came from. */
  seriesSource: Record<string, SeriesSource>;
  /** Change and low/high for the requested range, per symbol. */
  rangeStats: Record<string, RangeStats>;
  range: TimeRange;
  status: MarketStatus;
  dataLabel: string;
  /** True when quotes are real market prices (any provider except the mock). */
  quotesLive: boolean;
  /**
   * Symbols whose range figures fall back to today's numbers because real quotes sit on
   * modeled history for the selected range. Empty for live / 1D and for the mock provider.
   */
  todayOnly: string[];
  asOf: number;
};

/**
 * Optional store of recorded quotes. When the provider has no real intraday history, the
 * facade records each quote it serves and reads them back to build real Live / 1H / 1D series.
 */
export type PriceHistoryStore = {
  recordTicks(quotes: Quote[]): Promise<void>;
  getTicks(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]>;
};

/** Everything the Watch dashboard needs for a set of symbols in one call. */
export async function getWatchSnapshot(
  symbols: string[],
  range: TimeRange,
  history?: PriceHistoryStore,
): Promise<WatchSnapshot> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const provider = getMarketDataProvider();
  const now = Date.now();
  const [quotes, status, seriesList] = await Promise.all([
    unique.length ? provider.getQuotes(unique) : Promise.resolve([]),
    provider.getMarketStatus(),
    Promise.all(unique.map((s) => provider.getHistoricalPrices(s, range))),
  ]);
  const quotesLive = provider.id !== "mock";
  if (history && quotesLive && quotes.length) void history.recordTicks(quotes);

  const quoteMap: Record<string, Quote> = {};
  for (const q of quotes) quoteMap[q.symbol] = q;
  const series: Record<string, number[]> = {};
  const seriesSource: Record<string, SeriesSource> = {};
  const rangeStats: Record<string, RangeStats> = {};
  const todayOnly: string[] = [];
  const window = tickWindow(range, now);

  await Promise.all(
    unique.map(async (s, i) => {
      const q = quoteMap[s];
      let { points, source } = seriesList[i];

      // Replace a modeled intraday series with recorded real ticks once enough exist.
      if (source === "modeled" && quotesLive && history && window) {
        const ticks = await history.getTicks(s, window.from, window.to + 60_000);
        if (ticks.length > 1 && ticks[ticks.length - 1].t - ticks[0].t >= window.minSpanMs) {
          points = ticks;
          source = "recorded";
        }
      }

      if (q) points = alignSeriesToQuote(points, q);
      series[s] = points.map((p) => p.price);
      seriesSource[s] = source;
      if (!q) return;
      const mixed = quotesLive && source === "modeled" && range !== "live" && range !== "1D";
      if (mixed) todayOnly.push(s);
      rangeStats[s] = computeRangeStats(q, points, mixed ? "1D" : range);
    }),
  );

  return {
    quotes: quoteMap,
    series,
    seriesSource,
    rangeStats,
    range,
    status,
    dataLabel: provider.dataLabel,
    quotesLive,
    todayOnly,
    asOf: now,
  };
}
