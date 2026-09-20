export const TIME_RANGES = ["live", "1H", "1D", "1W", "1M", "1Y"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export function isTimeRange(value: unknown): value is TimeRange {
  return typeof value === "string" && (TIME_RANGES as readonly string[]).includes(value);
}

export type Quote = {
  symbol: string;
  companyName: string | null;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayLow: number;
  dayHigh: number;
  /** Epoch milliseconds of the quote. */
  asOf: number;
};

export type PricePoint = {
  /** Epoch milliseconds. */
  t: number;
  price: number;
  /** Intraday extremes for the bar ending at `t`, when the source provides them. */
  low?: number;
  high?: number;
};

/** Where a series came from. "modeled" is synthetic; the others are real market prices. */
export type SeriesSource = "market" | "recorded" | "modeled";

export type PriceSeries = { points: PricePoint[]; source: SeriesSource };

/** One trading session's open, high, low and close. `t` is the session date at 00:00 UTC. */
export type DailyBar = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type DailyBars = { bars: DailyBar[]; source: SeriesSource };

/** One intraday bar (regular hours). `t` is the bar's start, epoch ms. */
export type IntradayBar = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** All intraday bars of one regular session, in time order. */
export type IntradaySession = { dateKey: string; bars: IntradayBar[]; intervalMinutes: number };

export type IntradayHistory = {
  sessions: IntradaySession[];
  intervalMinutes: number;
  source: SeriesSource;
};

export type MarketState =
  "open" | "closed-weekend" | "closed-holiday" | "pre-market" | "after-hours";

export type MarketStatus = {
  state: MarketState;
  isOpen: boolean;
  /** Ready-to-display label, e.g. "Market open" or "Market closed · Weekend". */
  label: string;
  /** Epoch milliseconds when the state next changes, if known. */
  nextChangeAt: number | null;
};

export type SymbolMatch = {
  symbol: string;
  companyName: string;
};

/**
 * Every market-data source implements this. The UI only ever talks to the facade in
 * provider.ts, so swapping the mock for Alpaca, Polygon or Finnhub touches nothing else.
 */
export interface MarketDataProvider {
  /** Short identifier, e.g. "mock". */
  readonly id: string;
  /** Caption shown next to the polling status, e.g. "modeled history" or "delayed 15 min". */
  readonly dataLabel: string;
  /** True when price history (series) is synthetic rather than from the market. */
  readonly historyModeled: boolean;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getHistoricalPrices(symbol: string, range: TimeRange): Promise<PriceSeries>;
  /**
   * Up to `count` most recent complete daily bars (oldest first). Used by the simulation
   * engine, which refuses modeled bars, so a provider without real history must throw.
   */
  getDailyBars(symbol: string, count: number): Promise<DailyBars>;
  /**
   * Regular-hours intraday bars for roughly the last `sessions` completed sessions at
   * `intervalMinutes` resolution. Must throw rather than return modeled data (dev mock excepted).
   */
  getIntradayHistory(
    symbol: string,
    sessions: number,
    intervalMinutes: number,
  ): Promise<IntradayHistory>;
  /** Next scheduled earnings date (YYYY-MM-DD) if the provider knows it; null when unknown. */
  getNextEarningsDate(symbol: string): Promise<string | null>;
  /** Prices between two instants (epoch ms), used for a trade's chart. Resolution is up to the provider. */
  getPricesBetween(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]>;
  getMarketStatus(now?: Date): Promise<MarketStatus>;
  searchSymbols(query: string): Promise<SymbolMatch[]>;
  /** Company name for a symbol, if the provider knows it. */
  lookupSymbol(symbol: string): Promise<SymbolMatch | null>;
}
