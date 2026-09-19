import { cached } from "../cache";
import {
  getMarketStatusAt,
  latestSessionOpen,
  previousSessionOpen,
  sessionClose,
} from "../market-hours";
import { findSymbol, searchDirectory } from "../symbols";
import type {
  MarketDataProvider,
  MarketStatus,
  PricePoint,
  PriceSeries,
  Quote,
  SymbolMatch,
  TimeRange,
} from "../types";

/**
 * Alpaca Market Data adapter (https://docs.alpaca.markets/docs/about-market-data-api).
 * Free accounts get IEX-feed quotes and bars. Keys are read on the server only.
 *
 * Env:
 *   MARKET_DATA_PROVIDER=alpaca
 *   MARKET_DATA_API_KEY=<APCA-API-KEY-ID>
 *   MARKET_DATA_API_SECRET=<APCA-API-SECRET-KEY>
 */

const DATA_BASE = "https://data.alpaca.markets";
const TRADING_BASE = process.env.ALPACA_TRADING_BASE ?? "https://paper-api.alpaca.markets";
const FEED = process.env.ALPACA_FEED ?? "iex";
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// --- Raw shapes (subset) ----------------------------------------------------
export type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number };
export type AlpacaSnapshot = {
  latestTrade?: { p: number; t: string };
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
};
type SnapshotsResponse = Record<string, AlpacaSnapshot>;
type BarsResponse = {
  bars: Record<string, AlpacaBar[] | undefined>;
  next_page_token: string | null;
};
type ClockResponse = { is_open: boolean; next_open: string; next_close: string; timestamp: string };
type AssetResponse = { symbol: string; name: string; status: string };

// --- Pure mapping (unit-tested) -----------------------------------------------
export function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

export function mapSnapshotToQuote(
  symbol: string,
  s: AlpacaSnapshot,
  companyName: string | null,
  now: number,
): Quote | null {
  const price = s.latestTrade?.p ?? s.minuteBar?.c ?? s.dailyBar?.c;
  const previousClose = s.prevDailyBar?.c;
  if (price == null || previousClose == null || previousClose <= 0) return null;
  const change = price - previousClose;
  return {
    symbol,
    companyName,
    price: round4(price),
    previousClose: round4(previousClose),
    change: round4(change),
    changePercent: round4((change / previousClose) * 100),
    dayLow: round4(Math.min(s.dailyBar?.l ?? price, price)),
    dayHigh: round4(Math.max(s.dailyBar?.h ?? price, price)),
    asOf: s.latestTrade?.t ? Date.parse(s.latestTrade.t) : now,
  };
}

export function mapBars(bars: AlpacaBar[] | undefined): PricePoint[] {
  return (bars ?? [])
    .map((b) => ({ t: Date.parse(b.t), price: round4(b.c) }))
    .filter((p) => Number.isFinite(p.t));
}

/** Bar timeframe and window for each UI range, anchored to the latest session. */
export function rangeWindow(
  range: TimeRange,
  now: number,
): { timeframe: string; start: number; end: number } {
  const open = latestSessionOpen(now);
  const close = sessionClose(open);
  const end = Math.min(now, close);
  switch (range) {
    case "live":
      return { timeframe: "1Min", start: end - 60 * MINUTE_MS, end: now };
    case "1H":
      return { timeframe: "1Min", start: Math.max(open, end - 60 * MINUTE_MS), end };
    case "1D":
      return { timeframe: "15Min", start: open, end };
    case "1W":
      return { timeframe: "1Hour", start: previousSessionOpen(open, 4), end };
    case "1M":
      return { timeframe: "1Day", start: now - 35 * DAY_MS, end: now };
    case "1Y":
      return { timeframe: "1Day", start: now - 370 * DAY_MS, end: now };
  }
}

export function timeframeForSpan(spanMs: number): string {
  const days = spanMs / DAY_MS;
  if (days <= 2) return "15Min";
  if (days <= 10) return "1Hour";
  return "1Day";
}

// --- Provider -----------------------------------------------------------------
export class AlpacaMarketDataProvider implements MarketDataProvider {
  readonly id = "alpaca";
  readonly dataLabel = FEED === "sip" ? "live quotes" : "IEX quotes";
  readonly historyModeled = false;

  constructor(
    private readonly keyId: string,
    private readonly secret: string,
  ) {}

  private async request<T>(base: string, path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, base);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.keyId,
        "APCA-API-SECRET-KEY": this.secret,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Alpaca ${path} failed: ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort();
    if (unique.length === 0) return [];
    return cached(`alpaca:quotes:${unique.join(",")}`, 10_000, async () => {
      const data = await this.request<SnapshotsResponse>(DATA_BASE, "/v2/stocks/snapshots", {
        symbols: unique.join(","),
        feed: FEED,
      });
      const now = Date.now();
      const quotes: Quote[] = [];
      for (const symbol of unique) {
        const snap = data[symbol];
        if (!snap) continue;
        const q = mapSnapshotToQuote(symbol, snap, findSymbol(symbol)?.companyName ?? null, now);
        if (q) quotes.push(q);
      }
      return quotes;
    });
  }

  async getQuote(symbol: string): Promise<Quote> {
    const [q] = await this.getQuotes([symbol]);
    if (!q) throw new Error(`No quote for ${symbol}`);
    return q;
  }

  private async bars(
    symbol: string,
    timeframe: string,
    start: number,
    end: number,
  ): Promise<PricePoint[]> {
    const points: PricePoint[] = [];
    let pageToken: string | null = null;
    do {
      const params: Record<string, string> = {
        symbols: symbol,
        timeframe,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        limit: "10000",
        feed: FEED,
        sort: "asc",
        adjustment: "split",
      };
      if (pageToken) params.page_token = pageToken;
      const data: BarsResponse = await this.request<BarsResponse>(
        DATA_BASE,
        "/v2/stocks/bars",
        params,
      );
      points.push(...mapBars(data.bars[symbol]));
      pageToken = data.next_page_token;
    } while (pageToken && points.length < 5000);
    return points;
  }

  async getHistoricalPrices(symbol: string, range: TimeRange): Promise<PriceSeries> {
    const sym = symbol.toUpperCase();
    const ttl =
      range === "live" || range === "1H"
        ? 30_000
        : range === "1D" || range === "1W"
          ? 5 * MINUTE_MS
          : 60 * MINUTE_MS;
    return cached(`alpaca:series:${sym}:${range}`, ttl, async () => {
      const w = rangeWindow(range, Date.now());
      return {
        points: await this.bars(sym, w.timeframe, w.start, w.end),
        source: "market" as const,
      };
    });
  }

  async getPricesBetween(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]> {
    const sym = symbol.toUpperCase();
    const to = Math.min(toMs, Date.now());
    if (!(to > fromMs)) return [];
    return cached(`alpaca:between:${sym}:${fromMs}:${to}`, 60 * MINUTE_MS, () =>
      this.bars(sym, timeframeForSpan(to - fromMs), fromMs, to),
    );
  }

  async getMarketStatus(now: Date = new Date()): Promise<MarketStatus> {
    try {
      const clock = await cached("alpaca:clock", 30_000, () =>
        this.request<ClockResponse>(TRADING_BASE, "/v2/clock", {}),
      );
      const local = getMarketStatusAt(now.getTime());
      if (clock.is_open === local.isOpen) return local;
      return clock.is_open
        ? {
            state: "open",
            isOpen: true,
            label: "Market open",
            nextChangeAt: Date.parse(clock.next_close),
          }
        : { ...local, isOpen: false, nextChangeAt: Date.parse(clock.next_open) };
    } catch {
      return getMarketStatusAt(now.getTime());
    }
  }

  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    // Alpaca has no symbol search endpoint on the data API; the local directory covers common names.
    return searchDirectory(query);
  }

  async lookupSymbol(symbol: string): Promise<SymbolMatch | null> {
    const sym = symbol.toUpperCase();
    const known = findSymbol(sym);
    if (known) return { symbol: known.symbol, companyName: known.companyName };
    try {
      const asset = await cached(`alpaca:asset:${sym}`, 24 * 60 * MINUTE_MS, () =>
        this.request<AssetResponse>(TRADING_BASE, `/v2/assets/${encodeURIComponent(sym)}`, {}),
      );
      return asset?.name ? { symbol: sym, companyName: asset.name } : null;
    } catch {
      return null;
    }
  }
}
