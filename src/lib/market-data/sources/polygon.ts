import { cached } from "../cache";
import { RateBudget } from "../rate-limit";
import type { DailyBar, PricePoint } from "../types";

/**
 * Polygon.io daily aggregates (free "Basic" plan: end-of-day bars, 2 years of history,
 * 5 requests per minute). Used as the first choice for 1W / 1M / 1Y history when
 * HISTORY_PROVIDER=polygon and HISTORY_API_KEY are set.
 */

const BASE = "https://api.polygon.io";
const DAY_MS = 86_400_000;
const budget = new RateBudget(5, 60_000);

export type PolygonAgg = { t: number; o: number; h: number; l: number; c: number; v: number };
type PolygonAggsResponse = {
  status?: string;
  results?: PolygonAgg[];
  error?: string;
  message?: string;
};

export function mapPolygonAggs(results: PolygonAgg[] | undefined): PricePoint[] {
  const r = (v: number) => Math.round(v * 10_000) / 10_000;
  return (results ?? [])
    .filter((a) => Number.isFinite(a.t) && Number.isFinite(a.c) && a.c > 0)
    .map((a) => ({
      t: a.t,
      price: r(a.c),
      low: a.l > 0 ? r(a.l) : undefined,
      high: a.h > 0 ? r(a.h) : undefined,
    }))
    .sort((a, b) => a.t - b.t);
}

export function mapPolygonBars(results: PolygonAgg[] | undefined): DailyBar[] {
  const r = (v: number) => Math.round(v * 10_000) / 10_000;
  return (results ?? [])
    .filter((a) => Number.isFinite(a.t) && a.o > 0 && a.h > 0 && a.l > 0 && a.c > 0)
    .map((a) => ({ t: a.t, open: r(a.o), high: r(a.h), low: r(a.l), close: r(a.c), volume: a.v }))
    .sort((a, b) => a.t - b.t);
}

/** About a year of daily OHLC bars, cached for an hour. */
export async function fetchPolygonDailyBars(symbol: string): Promise<DailyBar[]> {
  const key = process.env.HISTORY_API_KEY;
  if (!key) throw new Error("Polygon: HISTORY_API_KEY is not set");
  const sym = symbol.toUpperCase();
  return cached(`polygon:bars:${sym}`, 60 * 60_000, async () => {
    if (!budget.take()) throw new Error("Polygon: request budget spent for this minute");
    const now = Date.now();
    const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/1/day/${isoDate(now - 400 * DAY_MS)}/${isoDate(now)}?adjusted=true&sort=asc&limit=400`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Polygon ${sym} failed: ${res.status}`);
    const data = (await res.json()) as PolygonAggsResponse;
    if (data.error || data.status === "ERROR")
      throw new Error(`Polygon ${sym}: ${data.error ?? data.message ?? "error"}`);
    const bars = mapPolygonBars(data.results);
    if (bars.length === 0) throw new Error(`Polygon ${sym}: no data`);
    return bars;
  });
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isPolygonConfigured(): boolean {
  return (
    (process.env.HISTORY_PROVIDER ?? "").toLowerCase() === "polygon" &&
    Boolean(process.env.HISTORY_API_KEY)
  );
}

/**
 * Intraday bars for a completed session (the free plan does not serve the current day).
 * `fromMs`/`toMs` bound the request; cached until well after the session is over.
 */
export async function fetchPolygonIntraday(
  symbol: string,
  minutes: number,
  fromMs: number,
  toMs: number,
): Promise<PricePoint[]> {
  const key = process.env.HISTORY_API_KEY;
  if (!key) throw new Error("Polygon: HISTORY_API_KEY is not set");
  const sym = symbol.toUpperCase();
  return cached(
    `polygon:intraday:${sym}:${minutes}:${isoDate(fromMs)}`,
    12 * 60 * 60_000,
    async () => {
      if (!budget.take()) throw new Error("Polygon: request budget spent for this minute");
      const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${minutes}/minute/${fromMs}/${toMs}?adjusted=true&sort=asc&limit=5000`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Polygon ${sym} intraday failed: ${res.status}`);
      const data = (await res.json()) as PolygonAggsResponse;
      if (data.error || data.status === "ERROR")
        throw new Error(`Polygon ${sym}: ${data.error ?? data.message ?? "error"}`);
      const points = mapPolygonAggs(data.results).filter((p) => p.t >= fromMs && p.t <= toMs);
      if (points.length === 0) throw new Error(`Polygon ${sym}: no intraday bars for that session`);
      return points;
    },
  );
}

/** About a year of daily bars, cached for an hour. Throws when the minute budget is spent. */
export async function fetchPolygonDaily(symbol: string): Promise<PricePoint[]> {
  const key = process.env.HISTORY_API_KEY;
  if (!key) throw new Error("Polygon: HISTORY_API_KEY is not set");
  const sym = symbol.toUpperCase();
  return cached(`polygon:daily:${sym}`, 60 * 60_000, async () => {
    if (!budget.take()) throw new Error("Polygon: request budget spent for this minute");
    const now = Date.now();
    const url = `${BASE}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/1/day/${isoDate(now - 380 * DAY_MS)}/${isoDate(now)}?adjusted=true&sort=asc&limit=400`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Polygon ${sym} failed: ${res.status}`);
    const data = (await res.json()) as PolygonAggsResponse;
    if (data.error || data.status === "ERROR")
      throw new Error(`Polygon ${sym}: ${data.error ?? data.message ?? "error"}`);
    const points = mapPolygonAggs(data.results);
    if (points.length === 0) throw new Error(`Polygon ${sym}: no data`);
    return points;
  });
}
