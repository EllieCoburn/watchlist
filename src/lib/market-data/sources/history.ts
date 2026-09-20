import type { DailyBar, PricePoint, TimeRange } from "../types";
import { latestSessionOpen, sessionClose } from "../market-hours";
import {
  fetchPolygonDaily,
  fetchPolygonDailyBars,
  fetchPolygonIntraday,
  isPolygonConfigured,
} from "./polygon";
import { fetchDailyCloses, fetchStooqBars } from "./stooq";
import { fetchYahooChart, fetchYahooDailyBars, yahooParams } from "./yahoo";

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
    const count = range === "1W" ? 5 : range === "1M" ? 22 : 252;
    const dailySources: { name: string; load: () => Promise<PricePoint[]> }[] = [];
    if (isPolygonConfigured())
      dailySources.push({ name: "polygon", load: () => fetchPolygonDaily(symbol) });
    dailySources.push({ name: "stooq", load: () => fetchDailyCloses(symbol) });

    for (const src of dailySources) {
      try {
        const daily = await src.load();
        const points = daily.filter((p) => p.t <= now).slice(-count);
        attempts.push({ source: src.name, ok: points.length > 1, points: points.length });
        if (points.length > 1) return { points, attempts };
      } catch (err) {
        attempts.push({
          source: src.name,
          ok: false,
          points: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Finished session: official minute bars from Polygon for the intraday ranges.
  if (!dayBased && isPolygonConfigured()) {
    const open = latestSessionOpen(now);
    const close = sessionClose(open);
    if (now >= close) {
      const minutes = range === "1D" ? 5 : 1;
      const from = range === "1D" ? open : close - (range === "live" ? 10 : 60) * 60_000;
      try {
        const points = await fetchPolygonIntraday(symbol, minutes, from, close);
        attempts.push({ source: "polygon", ok: points.length > 1, points: points.length });
        if (points.length > 1) return { points, attempts };
      } catch (err) {
        attempts.push({
          source: "polygon",
          ok: false,
          points: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
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

/** Real daily OHLC bars from the first source that answers. Throws when none can. */
export async function fetchFreeDailyBars(
  symbol: string,
): Promise<{ bars: DailyBar[]; source: string; attempts: HistoryAttempt[] }> {
  const attempts: HistoryAttempt[] = [];
  const sources: { name: string; load: () => Promise<DailyBar[]> }[] = [];
  if (isPolygonConfigured())
    sources.push({ name: "polygon", load: () => fetchPolygonDailyBars(symbol) });
  sources.push({ name: "stooq", load: () => fetchStooqBars(symbol) });
  sources.push({ name: "yahoo", load: () => fetchYahooDailyBars(symbol) });
  for (const src of sources) {
    try {
      const bars = await src.load();
      attempts.push({ source: src.name, ok: bars.length > 1, points: bars.length });
      if (bars.length > 1) return { bars, source: src.name, attempts };
    } catch (err) {
      attempts.push({
        source: src.name,
        ok: false,
        points: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  throw new Error(
    `No daily history available for ${symbol}: ${attempts.map((a) => `${a.source} (${a.error ?? "no data"})`).join("; ")}`,
  );
}
