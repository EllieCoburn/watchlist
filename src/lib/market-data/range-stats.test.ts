import { describe, expect, it } from "vitest";
import { alignSeriesToQuote, computeRangeStats, rangeCaption, tickWindow } from "./range-stats";
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

  it("uses bar lows and highs when the source provides them", () => {
    const bars = [
      { t: 1000, price: 100, low: 90, high: 104 },
      { t: 2000, price: 102, low: 99, high: 125 },
    ];
    const s = computeRangeStats(quote, bars, "1M");
    expect(s.low).toBe(90);
    expect(s.high).toBe(125);
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

describe("tickWindow", () => {
  it("follows the trading session rather than wall-clock time", () => {
    const edt = (y: number, m: number, d: number, h: number, min = 0) =>
      Date.UTC(y, m - 1, d, h + 4, min);
    // Saturday: the 1H window is Friday's last hour.
    const w = tickWindow("1H", edt(2026, 9, 19, 12))!;
    expect(w.from).toBe(edt(2026, 9, 18, 15));
    expect(w.to).toBe(edt(2026, 9, 18, 16));
    // Friday 10:00: 1D runs from the open to now.
    const d = tickWindow("1D", edt(2026, 9, 18, 10))!;
    expect(d.from).toBe(edt(2026, 9, 18, 9, 30));
    expect(d.to).toBe(edt(2026, 9, 18, 10));
    expect(tickWindow("1M", 0)).toBeNull();
  });
});
