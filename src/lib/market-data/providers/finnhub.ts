import { cached } from "../cache";
import {
  getMarketStatusAt,
  latestSessionOpen,
  previousSessionOpen,
  sessionClose,
} from "../market-hours";
import { RateBudget } from "../rate-limit";
import { fetchFreeDailyBars, fetchFreeHistory } from "../sources/history";
import { fetchPolygonIntradayHistory, isPolygonConfigured } from "../sources/polygon";
import { fetchDailyCloses } from "../sources/stooq";
import { findSymbol, searchDirectory } from "../symbols";
import type {
  DailyBar,
  DailyBars,
  IntradayHistory,
  MarketDataProvider,
  MarketStatus,
  PricePoint,
  PriceSeries,
  Quote,
  SymbolMatch,
  TimeRange,
} from "../types";
import { MockMarketDataProvider } from "./mock";

/**
 * Finnhub adapter (https://finnhub.io/docs/api).
 *
 * Free tier facts that shape this adapter:
 *  - 60 requests per minute, one symbol per /quote call (no batch endpoint).
 *  - /stock/candle (historical bars) is NOT included for US stocks; it returns 403.
 *    When that happens the sparkline falls back to modeled history re-anchored to the
 *    real price, and the data label says so.
 *
 * Env:
 *   MARKET_DATA_PROVIDER=finnhub
 *   MARKET_DATA_API_KEY=<finnhub token>
 */

const BASE = "https://finnhub.io/api/v1";
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const QUOTE_TTL_MS = 15_000;

// --- Raw shapes (subset) ----------------------------------------------------
export type FinnhubQuote = {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};
export type FinnhubCandles = {
  s: "ok" | "no_data";
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];
};
type FinnhubEarnings = { earningsCalendar?: { date: string; symbol: string }[] };
type FinnhubSearch = { result?: { symbol: string; description: string; type: string }[] };
type FinnhubProfile = { name?: string; ticker?: string };
type FinnhubMarketStatus = { isOpen: boolean; session: string | null; holiday: string | null };

// --- Pure mapping (unit-tested) -----------------------------------------------
export function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

export function mapQuote(
  symbol: string,
  q: FinnhubQuote,
  companyName: string | null,
  now: number,
): Quote | null {
  if (!(q.c > 0) || !(q.pc > 0)) return null;
  const change = q.d ?? q.c - q.pc;
  return {
    symbol,
    companyName,
    price: round4(q.c),
    previousClose: round4(q.pc),
    change: round4(change),
    changePercent: round4(q.dp ?? (change / q.pc) * 100),
    dayLow: round4(Math.min(q.l > 0 ? q.l : q.c, q.c)),
    dayHigh: round4(Math.max(q.h > 0 ? q.h : q.c, q.c)),
    asOf: q.t > 0 ? q.t * 1000 : now,
  };
}

export function mapDailyCandles(data: FinnhubCandles): DailyBar[] {
  if (data.s !== "ok" || !data.t || !data.o || !data.h || !data.l || !data.c) return [];
  const r = (v: number) => Math.round(v * 10_000) / 10_000;
  const bars: DailyBar[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const o = data.o[i],
      h = data.h[i],
      l = data.l[i],
      c = data.c[i];
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    const day = new Date(data.t[i] * 1000);
    bars.push({
      t: Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
      open: r(o),
      high: r(h),
      low: r(l),
      close: r(c),
      volume: data.v?.[i],
    });
  }
  return bars;
}

export function mapCandles(data: FinnhubCandles): PricePoint[] {
  if (data.s !== "ok" || !data.t || !data.c) return [];
  const points: PricePoint[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const t = data.t[i] * 1000;
    const price = data.c[i];
    if (Number.isFinite(t) && Number.isFinite(price)) points.push({ t, price: round4(price) });
  }
  return points;
}

/** Candle resolution and window for each UI range. */
export function rangeWindow(
  range: TimeRange,
  now: number,
): { resolution: string; from: number; to: number } {
  const open = latestSessionOpen(now);
  const end = Math.min(now, sessionClose(open));
  switch (range) {
    case "live":
      return { resolution: "1", from: end - 60 * MINUTE_MS, to: now };
    case "1H":
      return { resolution: "1", from: Math.max(open, end - 60 * MINUTE_MS), to: end };
    case "1D":
      return { resolution: "15", from: open, to: end };
    case "1W":
      return { resolution: "60", from: previousSessionOpen(open, 4), to: end };
    case "1M":
      return { resolution: "D", from: now - 35 * DAY_MS, to: now };
    case "1Y":
      return { resolution: "D", from: now - 370 * DAY_MS, to: now };
  }
}

/** Scales a modeled series so its last point equals `anchorPrice`, keeping the shape. */
export function reanchor(points: PricePoint[], anchorPrice: number): PricePoint[] {
  if (points.length === 0 || !(anchorPrice > 0)) return points;
  const last = points[points.length - 1].price;
  if (!(last > 0)) return points;
  const k = anchorPrice / last;
  return points.map((p) => ({ t: p.t, price: round4(p.price * k) }));
}

// --- Provider -----------------------------------------------------------------
export class FinnhubMarketDataProvider implements MarketDataProvider {
  readonly id = "finnhub";
  private readonly budget = new RateBudget(55, MINUTE_MS);
  private readonly mock = new MockMarketDataProvider();
  private candlesUnavailable = false;
  private lastQuotes = new Map<string, Quote>();

  constructor(private readonly token: string) {}

  get dataLabel(): string {
    return this.candlesUnavailable ? "live quotes · modeled history" : "live quotes";
  }

  get historyModeled(): boolean {
    return this.candlesUnavailable;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.budget.take()) throw new Error("Finnhub request budget exhausted for this minute");
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: { "X-Finnhub-Token": this.token, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Finnhub ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const sym = symbol.toUpperCase();
    return cached(`finnhub:quote:${sym}`, QUOTE_TTL_MS, async () => {
      try {
        const raw = await this.request<FinnhubQuote>("/quote", { symbol: sym });
        const name =
          findSymbol(sym)?.companyName ?? (await this.lookupSymbol(sym))?.companyName ?? null;
        const q = mapQuote(sym, raw, name, Date.now());
        if (!q) throw new Error(`No quote for ${sym}`);
        this.lastQuotes.set(sym, q);
        return q;
      } catch (err) {
        // Out of budget or transient failure: serve the last real quote if we have one.
        const stale = this.lastQuotes.get(sym);
        if (stale) return stale;
        throw err;
      }
    });
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
    const results = await Promise.allSettled(unique.map((s) => this.getQuote(s)));
    const quotes: Quote[] = [];
    results.forEach((r) => {
      if (r.status === "fulfilled") quotes.push(r.value);
    });
    if (quotes.length === 0 && unique.length > 0) throw new Error("Finnhub returned no quotes");
    return quotes;
  }

  private async candles(
    sym: string,
    resolution: string,
    from: number,
    to: number,
  ): Promise<PricePoint[] | null> {
    if (this.candlesUnavailable) return null;
    try {
      const data = await this.request<FinnhubCandles>("/stock/candle", {
        symbol: sym,
        resolution,
        from: String(Math.floor(from / 1000)),
        to: String(Math.floor(to / 1000)),
      });
      return mapCandles(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("403")) {
        this.candlesUnavailable = true;
        console.warn(
          "[market-data] Finnhub candles are not available on this plan; using modeled history.",
        );
        return null;
      }
      throw err;
    }
  }

  /** Real daily closes from the free end-of-day source, or null when unavailable. */
  private async dailyCloses(sym: string): Promise<PricePoint[] | null> {
    try {
      return await fetchDailyCloses(sym);
    } catch (err) {
      console.warn(
        "[market-data] daily history unavailable:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  async getHistoricalPrices(symbol: string, range: TimeRange): Promise<PriceSeries> {
    const sym = symbol.toUpperCase();
    const ttl =
      range === "live" || range === "1H"
        ? 30_000
        : range === "1D" || range === "1W"
          ? 5 * MINUTE_MS
          : 60 * MINUTE_MS;
    return cached(`finnhub:series:${sym}:${range}`, ttl, async () => {
      const now = Date.now();
      const w = rangeWindow(range, now);

      // 1. Finnhub candles (paid plans).
      const real = await this.candles(sym, w.resolution, w.from, w.to);
      if (real && real.length > 1) return { points: real, source: "market" as const };

      // 2. Free history sources (end-of-day closes, then Yahoo's chart data).
      const free = await fetchFreeHistory(sym, range, now);
      if (free.points.length > 1) return { points: free.points, source: "market" as const };
      for (const a of free.attempts) {
        if (!a.ok)
          console.warn(
            `[market-data] ${a.source} history for ${sym} (${range}) unavailable: ${a.error ?? "no data"}`,
          );
      }

      // 3. Modeled shape anchored to the real price. The caller may replace this with recorded ticks.
      const modeled = await this.mock.getHistoricalPrices(sym, range);
      const anchor = this.lastQuotes.get(sym)?.price;
      return {
        points: anchor ? reanchor(modeled.points, anchor) : modeled.points,
        source: "modeled" as const,
      };
    });
  }

  async getPricesBetween(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]> {
    const sym = symbol.toUpperCase();
    const to = Math.min(toMs, Date.now());
    if (!(to > fromMs)) return [];
    const days = (to - fromMs) / DAY_MS;
    const resolution = days <= 2 ? "15" : days <= 10 ? "60" : "D";
    return cached(`finnhub:between:${sym}:${fromMs}:${to}`, 60 * MINUTE_MS, async () => {
      const real = await this.candles(sym, resolution, fromMs, to);
      if (real && real.length > 1) return real;
      if (days > 2) {
        const daily = await this.dailyCloses(sym);
        const points = daily?.filter((p) => p.t >= fromMs && p.t <= to) ?? [];
        if (points.length > 1) return points;
      }
      return this.mock.getPricesBetween(sym, fromMs, to);
    });
  }

  async getDailyBars(symbol: string, count: number): Promise<DailyBars> {
    const sym = symbol.toUpperCase();
    return cached(`finnhub:dailybars:${sym}`, 60 * MINUTE_MS, async () => {
      const now = Date.now();
      // Paid plans: Finnhub's own daily candles.
      if (!this.candlesUnavailable) {
        try {
          const data = await this.request<FinnhubCandles>("/stock/candle", {
            symbol: sym,
            resolution: "D",
            from: String(Math.floor((now - Math.ceil(count * 1.6) * DAY_MS) / 1000)),
            to: String(Math.floor(now / 1000)),
          });
          const bars = mapDailyCandles(data).slice(-count);
          if (bars.length > 1) return { bars, source: "market" as const };
        } catch (err) {
          if (err instanceof Error && err.message.includes("403")) this.candlesUnavailable = true;
          else throw err;
        }
      }
      const free = await fetchFreeDailyBars(sym);
      return { bars: free.bars.slice(-count), source: "market" as const };
    });
  }

  async getIntradayHistory(
    symbol: string,
    sessions: number,
    intervalMinutes: number,
  ): Promise<IntradayHistory> {
    // Finnhub's free plan has no candles; the history provider supplies intraday bars.
    if (isPolygonConfigured())
      return fetchPolygonIntradayHistory(symbol, sessions, intervalMinutes);
    throw new Error(
      "Intraday history is not available: configure HISTORY_PROVIDER=polygon (or use the Alpaca provider).",
    );
  }

  async getNextEarningsDate(symbol: string): Promise<string | null> {
    const sym = symbol.toUpperCase();
    try {
      return await cached(`finnhub:earnings:${sym}`, 12 * 60 * MINUTE_MS, async () => {
        const today = new Date();
        const to = new Date(today.getTime() + 60 * DAY_MS);
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const data = await this.request<FinnhubEarnings>("/calendar/earnings", {
          symbol: sym,
          from: iso(today),
          to: iso(to),
        });
        const dates = (data.earningsCalendar ?? [])
          .map((e) => e.date)
          .filter(Boolean)
          .sort();
        return dates[0] ?? null;
      });
    } catch {
      return null;
    }
  }

  async getMarketStatus(now: Date = new Date()): Promise<MarketStatus> {
    const local = getMarketStatusAt(now.getTime());
    try {
      const s = await cached("finnhub:market-status", 60_000, () =>
        this.request<FinnhubMarketStatus>("/stock/market-status", { exchange: "US" }),
      );
      if (s.isOpen === local.isOpen) return local;
      if (s.isOpen)
        return {
          state: "open",
          isOpen: true,
          label: "Market open",
          nextChangeAt: local.nextChangeAt,
        };
      if (s.holiday)
        return {
          state: "closed-holiday",
          isOpen: false,
          label: "Market closed · Holiday",
          nextChangeAt: local.nextChangeAt,
        };
      return { ...local, isOpen: false };
    } catch {
      return local;
    }
  }

  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    const q = query.trim();
    if (!q) return [];
    const local = searchDirectory(q);
    if (local.length >= 5) return local;
    try {
      const data = await cached(`finnhub:search:${q.toUpperCase()}`, 60 * MINUTE_MS, () =>
        this.request<FinnhubSearch>("/search", { q, exchange: "US" }),
      );
      const remote = (data.result ?? [])
        .filter((r) => r.type === "Common Stock" || r.type === "ETP")
        .slice(0, 8)
        .map((r) => ({ symbol: r.symbol, companyName: r.description }));
      const seen = new Set(local.map((m) => m.symbol));
      return [...local, ...remote.filter((m) => !seen.has(m.symbol))].slice(0, 8);
    } catch {
      return local;
    }
  }

  async lookupSymbol(symbol: string): Promise<SymbolMatch | null> {
    const sym = symbol.toUpperCase();
    const known = findSymbol(sym);
    if (known) return { symbol: known.symbol, companyName: known.companyName };
    try {
      const p = await cached(`finnhub:profile:${sym}`, 24 * 60 * MINUTE_MS, () =>
        this.request<FinnhubProfile>("/stock/profile2", { symbol: sym }),
      );
      return p?.name ? { symbol: sym, companyName: p.name } : null;
    } catch {
      return null;
    }
  }
}
