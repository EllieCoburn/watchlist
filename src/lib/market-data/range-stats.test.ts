import { describe, expect, it } from "vitest";
import { alignSeriesToQuote, computeRangeStats, rangeCaption } from "./range-stats";
import type { Quote } from "./types";

const quote: Quote = {
  symbol: "AAPL",
  companyName: "Apple Inc",
  price: 110,
  previousClose: 108,
  change: 2,
  changePercent: 1.8519,
  dayLow: 107,
  dayHigh: 111,
  asOf: 10_000,
};
const points = [
  { t: 1000, price: 100 },
  { t: 2000, price: 95 },
  { t: 3000, price: 120 },
  { t: 4000, price: 110 },
];

describe("computeRangeStats", () => {
  it("uses the session figures for live and 1D", () => {
    expect(computeRangeStats(quote, points, "1D")).toEqual({
      change: 2,
      changePercent: 1.8519,
      low: 107,
      high: 111,
      basis: "day",
    });
    expect(computeRangeStats(quote, points, "live").basis).toBe("day");
  });

  it("measures longer ranges from the first point to the current price", () => {
    const s = computeRangeStats(quote, points, "1W");
    expect(s.basis).toBe("range");
    expect(s.change).toBe(10);
    expect(s.changePercent).toBe(10);
    expect(s.low).toBe(95);
    expect(s.high).toBe(120);
  });

  it("falls back to session figures when the series is too short", () => {
    expect(computeRangeStats(quote, [{ t: 1, price: 100 }], "1M").basis).toBe("day");
  });
});

describe("alignSeriesToQuote", () => {
  it("appends the current price when the quote is newer than the last point", () => {
    const out = alignSeriesToQuote([{ t: 1000, price: 100 }], quote);
    expect(out).toEqual([
      { t: 1000, price: 100 },
      { t: 10_000, price: 110 },
    ]);
  });

  it("replaces the last point when the quote is not newer", () => {
    const out = alignSeriesToQuote(
      [
        { t: 1000, price: 100 },
        { t: 20_000, price: 100 },
      ],
      quote,
    );
    expect(out).toEqual([
      { t: 1000, price: 100 },
      { t: 20_000, price: 110 },
    ]);
  });

  it("leaves an already aligned series alone", () => {
    const aligned = [{ t: 1000, price: 110 }];
    expect(alignSeriesToQuote(aligned, quote)).toBe(aligned);
  });
});

describe("rangeCaption", () => {
  it("labels live as a day", () => {
    expect(rangeCaption("live")).toBe("1d");
    expect(rangeCaption("1W")).toBe("1w");
  });
});
