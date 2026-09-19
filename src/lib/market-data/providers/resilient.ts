import type {
  MarketDataProvider,
  MarketStatus,
  PricePoint,
  PriceSeries,
  Quote,
  SymbolMatch,
  TimeRange,
} from "../types";

const COOL_DOWN_MS = 60_000;

/**
 * Wraps a live provider so a failure never blanks the UI: each call falls back to the
 * mock provider, and the data label says so for a minute after the last failure.
 */
export class ResilientProvider implements MarketDataProvider {
  private lastFailure = 0;

  constructor(
    private readonly primary: MarketDataProvider,
    private readonly fallback: MarketDataProvider,
  ) {}

  get id(): string {
    return this.primary.id;
  }

  get historyModeled(): boolean {
    return Date.now() - this.lastFailure < COOL_DOWN_MS ? true : this.primary.historyModeled;
  }

  get dataLabel(): string {
    return Date.now() - this.lastFailure < COOL_DOWN_MS
      ? "modeled · live data unavailable"
      : this.primary.dataLabel;
  }

  private async attempt<T>(op: string, run: (p: MarketDataProvider) => Promise<T>): Promise<T> {
    try {
      return await run(this.primary);
    } catch (err) {
      if (Date.now() - this.lastFailure > COOL_DOWN_MS) {
        console.error(
          `[market-data] ${this.primary.id}.${op} failed, using mock:`,
          err instanceof Error ? err.message : err,
        );
      }
      this.lastFailure = Date.now();
      return run(this.fallback);
    }
  }

  getQuote(symbol: string): Promise<Quote> {
    return this.attempt("getQuote", (p) => p.getQuote(symbol));
  }
  getQuotes(symbols: string[]): Promise<Quote[]> {
    return this.attempt("getQuotes", (p) => p.getQuotes(symbols));
  }
  getHistoricalPrices(symbol: string, range: TimeRange): Promise<PriceSeries> {
    return this.attempt("getHistoricalPrices", (p) => p.getHistoricalPrices(symbol, range));
  }
  getPricesBetween(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]> {
    return this.attempt("getPricesBetween", (p) => p.getPricesBetween(symbol, fromMs, toMs));
  }
  getMarketStatus(now?: Date): Promise<MarketStatus> {
    return this.attempt("getMarketStatus", (p) => p.getMarketStatus(now));
  }
  searchSymbols(query: string): Promise<SymbolMatch[]> {
    return this.attempt("searchSymbols", (p) => p.searchSymbols(query));
  }
  lookupSymbol(symbol: string): Promise<SymbolMatch | null> {
    return this.attempt("lookupSymbol", (p) => p.lookupSymbol(symbol));
  }
}
