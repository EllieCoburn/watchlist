import {
  SESSION_LENGTH_MINUTES,
  getMarketStatusAt,
  isTradingDay,
  latestSessionOpen,
  sessionClose,
  sessionOpen,
} from "../market-hours";
import { findSymbol, searchDirectory } from "../symbols";
import type {
  DailyBar,
  DailyBars,
  MarketDataProvider,
  MarketStatus,
  PricePoint,
  PriceSeries,
  Quote,
  SymbolMatch,
  TimeRange,
} from "../types";

/**
 * Deterministic mock market data.
 *
 * Price is a pure function of (symbol, timestamp):
 *  - a daily random walk of session closes, anchored so that today's price sits near the
 *    directory's base price;
 *  - inside each session, a Brownian bridge from the open to the close so intraday
 *    sparklines look alive but always land on the right closing price.
 * Refreshing the page therefore never rewrites history, and every user sees the same prices.
 */

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const ORIGIN_TS = Date.UTC(2025, 5, 2, 12); // Mon 2 June 2025, midday UTC
const ANCHOR_TS = Date.UTC(2026, 8, 18, 12); // Fri 18 Sept 2026: base prices apply here

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
const sessionOpens: number[] = [];

/** Session opens (epoch ms) for every trading day from ORIGIN through the session containing `ts`. */
function ensureSessions(ts: number): void {
  let cursor =
    sessionOpens.length === 0 ? ORIGIN_TS : sessionOpens[sessionOpens.length - 1] + DAY_MS;
  const limit = ts + DAY_MS;
  while (cursor <= limit) {
    if (isTradingDay(cursor)) sessionOpens.push(sessionOpen(cursor));
    cursor += DAY_MS;
  }
}

/** Index of the latest session whose open is ≤ ts. */
function sessionIndexAt(ts: number): number {
  ensureSessions(ts);
  const open = latestSessionOpen(ts);
  let lo = 0;
  let hi = sessionOpens.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sessionOpens[mid] <= open) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Daily closes
// ---------------------------------------------------------------------------
type SymbolModel = { basePrice: number; volatility: number; companyName: string | null };

function modelFor(symbol: string): SymbolModel {
  const known = findSymbol(symbol);
  if (known)
    return {
      basePrice: known.basePrice,
      volatility: known.volatility,
      companyName: known.companyName,
    };
  const h = hash32(symbol);
  return { basePrice: 12 + (h % 380), volatility: 0.018 + (h % 7) * 0.003, companyName: null };
}

const closesCache = new Map<string, { raw: number[]; scale: number }>();

function dailyReturn(symbol: string, index: number, volatility: number): number {
  const rng = mulberry32(hash32(`${symbol}:day:${index}`));
  return volatility * gaussian(rng) + 0.0002;
}

/** Closing prices aligned with sessionOpens[0..upToIndex]. */
function closesFor(symbol: string, upToIndex: number): number[] {
  const { basePrice, volatility } = modelFor(symbol);
  let entry = closesCache.get(symbol);
  if (!entry) {
    entry = { raw: [], scale: 0 };
    closesCache.set(symbol, entry);
  }
  const raw = entry.raw;
  let logPrice = raw.length === 0 ? 0 : Math.log(raw[raw.length - 1]);
  for (let i = raw.length; i <= upToIndex; i++) {
    logPrice += dailyReturn(symbol, i, volatility);
    raw.push(Math.exp(logPrice));
  }
  if (entry.scale === 0) {
    const anchorIndex = sessionIndexAt(ANCHOR_TS);
    if (raw.length <= anchorIndex) return closesFor(symbol, anchorIndex).slice(0, upToIndex + 1);
    entry.scale = basePrice / raw[anchorIndex];
  }
  return raw.slice(0, upToIndex + 1).map((v) => v * entry!.scale);
}

function closeAt(symbol: string, index: number): number {
  const closes = closesFor(symbol, Math.max(index, 0));
  return closes[Math.max(index, 0)];
}

// ---------------------------------------------------------------------------
// Intraday bridge
// ---------------------------------------------------------------------------
const intradayCache = new Map<string, Float64Array>();

/** Log-price at each minute 0..390 of session `index`. */
function intradayLogPath(symbol: string, index: number): Float64Array {
  const key = `${symbol}:${index}`;
  const cached = intradayCache.get(key);
  if (cached) return cached;
  if (intradayCache.size > 400) intradayCache.clear();

  const { volatility } = modelFor(symbol);
  const prevClose = closeAt(symbol, index - 1);
  const close = closeAt(symbol, index);
  const rng = mulberry32(hash32(`${symbol}:intraday:${index}`));

  const dailyMove = Math.log(close / prevClose);
  const logOpen = Math.log(prevClose) + dailyMove * 0.3 + volatility * 0.15 * gaussian(rng);
  const logClose = Math.log(close);
  const stepVol = (volatility * 1.1) / Math.sqrt(SESSION_LENGTH_MINUTES);

  const steps = new Float64Array(SESSION_LENGTH_MINUTES + 1);
  let cum = 0;
  for (let m = 1; m <= SESSION_LENGTH_MINUTES; m++) {
    cum += stepVol * gaussian(rng);
    steps[m] = cum;
  }
  const total = steps[SESSION_LENGTH_MINUTES];
  const path = new Float64Array(SESSION_LENGTH_MINUTES + 1);
  for (let m = 0; m <= SESSION_LENGTH_MINUTES; m++) {
    const f = m / SESSION_LENGTH_MINUTES;
    const bridge = steps[m] - f * total;
    path[m] = logOpen + f * (logClose - logOpen) + bridge;
  }
  intradayCache.set(key, path);
  return path;
}

function priceInSession(symbol: string, index: number, minute: number): number {
  const path = intradayLogPath(symbol, index);
  const clamped = Math.min(Math.max(minute, 0), SESSION_LENGTH_MINUTES);
  const lo = Math.floor(clamped);
  const hi = Math.min(lo + 1, SESSION_LENGTH_MINUTES);
  const frac = clamped - lo;
  return Math.exp(path[lo] + (path[hi] - path[lo]) * frac);
}

/** Price at any instant. Outside a session it is the last close. */
export function priceAt(symbol: string, ts: number): number {
  const index = sessionIndexAt(ts);
  const open = sessionOpens[index];
  const close = sessionClose(open);
  if (ts >= close) return closeAt(symbol, index);
  if (ts <= open) return priceInSession(symbol, index, 0);
  return priceInSession(symbol, index, (ts - open) / MINUTE_MS);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function buildQuote(symbol: string, now: number): Quote {
  const index = sessionIndexAt(now);
  const open = sessionOpens[index];
  const end = Math.min(now, sessionClose(open));
  const price = priceAt(symbol, now);
  const previousClose = closeAt(symbol, index - 1);

  let low = price;
  let high = price;
  const lastMinute = Math.max(0, Math.min(SESSION_LENGTH_MINUTES, (end - open) / MINUTE_MS));
  for (let m = 0; m <= lastMinute; m++) {
    const p = priceInSession(symbol, index, m);
    if (p < low) low = p;
    if (p > high) high = p;
  }

  const change = price - previousClose;
  return {
    symbol,
    companyName: modelFor(symbol).companyName,
    price: round4(price),
    previousClose: round4(previousClose),
    change: round4(change),
    changePercent: round4((change / previousClose) * 100),
    dayLow: round4(low),
    dayHigh: round4(high),
    asOf: now,
  };
}

function sampleSession(
  symbol: string,
  index: number,
  stepMinutes: number,
  until: number,
  points: PricePoint[],
): void {
  const open = sessionOpens[index];
  const end = Math.min(until, sessionClose(open));
  const lastMinute = Math.max(0, (end - open) / MINUTE_MS);
  for (let m = 0; m <= lastMinute; m += stepMinutes) {
    points.push({ t: open + m * MINUTE_MS, price: round4(priceInSession(symbol, index, m)) });
  }
  if (lastMinute % stepMinutes !== 0) {
    points.push({ t: end, price: round4(priceInSession(symbol, index, lastMinute)) });
  }
}

function buildSeries(symbol: string, range: TimeRange, now: number): PricePoint[] {
  const index = sessionIndexAt(now);
  const points: PricePoint[] = [];

  switch (range) {
    case "live": {
      for (let i = 59; i >= 0; i--) {
        const t = now - i * 10_000;
        points.push({ t, price: round4(priceAt(symbol, t)) });
      }
      return points;
    }
    case "1H": {
      const open = sessionOpens[index];
      const end = Math.min(now, sessionClose(open));
      const start = Math.max(open, end - 60 * MINUTE_MS);
      for (let t = start; t <= end; t += 2 * MINUTE_MS) {
        points.push({ t, price: round4(priceInSession(symbol, index, (t - open) / MINUTE_MS)) });
      }
      return points;
    }
    case "1D": {
      sampleSession(symbol, index, 15, now, points);
      return points;
    }
    case "1W": {
      for (let i = Math.max(0, index - 4); i <= index; i++)
        sampleSession(symbol, i, 60, now, points);
      return points;
    }
    case "1M":
    case "1Y": {
      const count = range === "1M" ? 22 : 252;
      const first = Math.max(0, index - count + 1);
      const closes = closesFor(symbol, index);
      for (let i = first; i <= index; i++) {
        const isLast = i === index;
        const price = isLast ? priceAt(symbol, now) : closes[i];
        points.push({ t: isLast ? now : sessionClose(sessionOpens[i]), price: round4(price) });
      }
      return points;
    }
  }
}

/** Prices between two instants: 15-minute samples for short spans, daily closes otherwise. */
function buildBetween(symbol: string, fromMs: number, toMs: number, now: number): PricePoint[] {
  const to = Math.min(toMs, now);
  if (!(to > fromMs)) return [];
  const first = sessionIndexAt(fromMs);
  const last = sessionIndexAt(to);
  const points: PricePoint[] = [];
  const spanDays = (to - fromMs) / DAY_MS;
  if (spanDays <= 5) {
    for (let i = first; i <= last; i++) sampleSession(symbol, i, 15, to, points);
    return points.filter((p) => p.t >= fromMs - MINUTE_MS && p.t <= to);
  }
  const closes = closesFor(symbol, last);
  for (let i = first; i <= last; i++) {
    const t = sessionClose(sessionOpens[i]);
    if (t < fromMs) continue;
    const isLast = i === last && t > to;
    points.push({ t: isLast ? to : t, price: round4(isLast ? priceAt(symbol, to) : closes[i]) });
  }
  return points;
}

/** Modeled daily OHLC bars for the `count` most recent complete sessions. */
function buildDailyBars(symbol: string, count: number, now: number): DailyBar[] {
  const latest = sessionIndexAt(now);
  const complete = now >= sessionClose(sessionOpens[latest]) ? latest : latest - 1;
  const first = Math.max(0, complete - count + 1);
  const closes = closesFor(symbol, complete);
  const bars: DailyBar[] = [];
  for (let i = first; i <= complete; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let m = 0; m <= SESSION_LENGTH_MINUTES; m += 5) {
      const p = priceInSession(symbol, i, m);
      if (p > high) high = p;
      if (p < low) low = p;
    }
    const open = priceInSession(symbol, i, 0);
    const close = closes[i];
    const day = new Date(sessionOpens[i]);
    bars.push({
      t: Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
      open: round4(open),
      high: round4(Math.max(high, open, close)),
      low: round4(Math.min(low, open, close)),
      close: round4(close),
    });
  }
  return bars;
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock";
  readonly dataLabel = "modeled prices · not live";
  readonly historyModeled = true;

  private now(): number {
    return Date.now();
  }

  async getQuote(symbol: string): Promise<Quote> {
    return buildQuote(symbol.toUpperCase(), this.now());
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const now = this.now();
    return symbols.map((s) => buildQuote(s.toUpperCase(), now));
  }

  async getHistoricalPrices(symbol: string, range: TimeRange): Promise<PriceSeries> {
    return { points: buildSeries(symbol.toUpperCase(), range, this.now()), source: "modeled" };
  }

  async getPricesBetween(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]> {
    return buildBetween(symbol.toUpperCase(), fromMs, toMs, this.now());
  }

  async getDailyBars(symbol: string, count: number): Promise<DailyBars> {
    return { bars: buildDailyBars(symbol.toUpperCase(), count, this.now()), source: "modeled" };
  }

  async getNextEarningsDate(): Promise<string | null> {
    return null;
  }

  async getMarketStatus(now: Date = new Date()): Promise<MarketStatus> {
    return getMarketStatusAt(now.getTime());
  }

  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    return searchDirectory(query);
  }

  async lookupSymbol(symbol: string): Promise<SymbolMatch | null> {
    const known = findSymbol(symbol);
    return known ? { symbol: known.symbol, companyName: known.companyName } : null;
  }
}

/** Test hook: quote and series for an explicit instant. */
export const __mockInternals = { buildQuote, buildSeries, buildBetween, buildDailyBars, priceAt };
