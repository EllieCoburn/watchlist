import type { PricePoint, TimeRange } from "../types";
import { fetchDailyCloses } from "./stooq";
import { fetchYahooChart, yahooParams } from "./yahoo";

export type HistoryAttempt = { source: string; ok: boolean; points: number; error?: string };

/**
 * Free history for providers whose plan has none. Tries each source in turn and reports
 * what happened so the diagnostics page can show it.
 */
export async function fetchFreeHistory(
  symbol: string,
  range: TimeRange,
  now = Date.now(),
): Promise<{ points: PricePoint[]; attempts: HistoryAttempt[] }> {
  const attempts: HistoryAttempt[] = [];
  const dayBased = range === "1W" || range === "1M" || range === "1Y";

  if (dayBased) {
    try {
      const daily = await fetchDailyCloses(symbol);
      const count = range === "1W" ? 5 : range === "1M" ? 22 : 252;
      const points = daily.filter((p) => p.t <= now).slice(-count);
      attempts.push({ source: "stooq", ok: points.length > 1, points: points.length });
      if (points.length > 1) return { points, attempts };
    } catch (err) {
      attempts.push({
        source: "stooq",
        ok: false,
        points: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const p = yahooParams(range);
    let points = await fetchYahooChart(symbol, p.range, p.interval);
    if (range === "live" || range === "1H") {
      const from = now - (range === "live" ? 10 : 60) * 60_000;
      const recent = points.filter((x) => x.t >= from);
      // Outside market hours keep the last hour of the latest session instead of nothing.
      points = recent.length > 1 ? recent : points.slice(-60);
    }
    attempts.push({ source: "yahoo", ok: points.length > 1, points: points.length });
    if (points.length > 1) return { points, attempts };
  } catch (err) {
    attempts.push({
      source: "yahoo",
      ok: false,
      points: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { points: [], attempts };
}
