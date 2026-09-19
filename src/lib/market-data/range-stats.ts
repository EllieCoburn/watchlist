import type { PricePoint, Quote, TimeRange } from "./types";

export type RangeStats = {
  /** Change over the selected range (today's change for live and 1D). */
  change: number;
  changePercent: number;
  low: number;
  high: number;
  /** "day" = today's session figures from the quote; "range" = derived from the series. */
  basis: "day" | "range";
};

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

/** Ensures the series ends at the current price so the sparkline and the numbers agree. */
export function alignSeriesToQuote(points: PricePoint[], quote: Quote): PricePoint[] {
  if (points.length === 0) return points;
  const last = points[points.length - 1];
  if (Math.abs(last.price - quote.price) < 1e-9) return points;
  if (quote.asOf >= last.t) return [...points, { t: quote.asOf, price: quote.price }];
  return [...points.slice(0, -1), { t: last.t, price: quote.price }];
}

/**
 * Change and low/high for the selected range. Live and 1D use the quote's session figures;
 * longer ranges measure from the first point in the series to the current price.
 */
export function computeRangeStats(
  quote: Quote,
  points: PricePoint[],
  range: TimeRange,
): RangeStats {
  const day: RangeStats = {
    change: quote.change,
    changePercent: quote.changePercent,
    low: quote.dayLow,
    high: quote.dayHigh,
    basis: "day",
  };
  if (range === "live" || range === "1D" || points.length < 2) return day;

  const first = points[0].price;
  if (!(first > 0)) return day;
  const lows = points.map((p) => p.low ?? p.price);
  const highs = points.map((p) => p.high ?? p.price);
  const change = quote.price - first;
  return {
    change: round4(change),
    changePercent: round4((change / first) * 100),
    low: round4(Math.min(...lows, quote.price, quote.dayLow)),
    high: round4(Math.max(...highs, quote.price, quote.dayHigh)),
    basis: "range",
  };
}

/** Caption for the low/high line, e.g. "1d", "1w". */
export function rangeCaption(range: TimeRange): string {
  return range === "live" ? "1d" : range.toLowerCase();
}
