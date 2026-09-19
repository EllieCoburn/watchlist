import { cached } from "../cache";
import { easternWallClock, SESSION_CLOSE_MINUTES } from "../market-hours";
import type { PricePoint } from "../types";

/**
 * Free end-of-day closes from Stooq (no key). Used to give Finnhub's free tier real
 * daily history for the 1W / 1M / 1Y ranges. Cached for an hour per symbol.
 * CSV: Date,Open,High,Low,Close,Volume
 */

const BASE = "https://stooq.com/q/d/l/";

export function toStooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase().replace(/\./g, "-")}.us`;
}

/** Epoch ms of the session close (16:00 ET) on a YYYY-MM-DD date. */
function closeTimestamp(date: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const noonUtc = Date.UTC(y, m - 1, d, 16);
  return easternWallClock(noonUtc, SESSION_CLOSE_MINUTES);
}

export function parseStooqCsv(csv: string): PricePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0].toLowerCase().startsWith("date")) return [];
  const points: PricePoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, , , , close] = line.split(",");
    const t = closeTimestamp(date);
    const price = Number(close);
    if (t != null && Number.isFinite(price) && price > 0)
      points.push({ t, price: Math.round(price * 10_000) / 10_000 });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

export async function fetchDailyCloses(symbol: string): Promise<PricePoint[]> {
  const sym = symbol.toUpperCase();
  return cached(`stooq:daily:${sym}`, 60 * 60_000, async () => {
    const url = `${BASE}?s=${encodeURIComponent(toStooqSymbol(sym))}&i=d`;
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/csv" } });
    if (!res.ok) throw new Error(`Stooq ${sym} failed: ${res.status}`);
    const text = await res.text();
    const points = parseStooqCsv(text);
    if (points.length === 0) throw new Error(`Stooq ${sym}: no data`);
    return points;
  });
}
