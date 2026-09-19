import { describe, expect, it } from "vitest";
import { RateBudget } from "../rate-limit";
import { mapCandles, mapQuote, rangeWindow, reanchor } from "./finnhub";

const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);

describe("finnhub mapping", () => {
  it("maps a quote", () => {
    const q = mapQuote(
      "AAPL",
      {
        c: 336.13,
        d: -1.77,
        dp: -0.5238,
        h: 338.49,
        l: 332.53,
        o: 337.5,
        pc: 337.9,
        t: 1789416000,
      },
      "Apple Inc",
      0,
    );
    expect(q).toEqual({
      symbol: "AAPL",
      companyName: "Apple Inc",
      price: 336.13,
      previousClose: 337.9,
      change: -1.77,
      changePercent: -0.5238,
      dayLow: 332.53,
      dayHigh: 338.49,
      asOf: 1789416000000,
    });
  });

  it("derives change when Finnhub omits it and rejects empty quotes", () => {
    const q = mapQuote(
      "X",
      { c: 110, d: null, dp: null, h: 0, l: 0, o: 0, pc: 100, t: 0 },
      null,
      5,
    );
    expect(q?.change).toBe(10);
    expect(q?.changePercent).toBe(10);
    expect(q?.dayLow).toBe(110);
    expect(q?.asOf).toBe(5);
    expect(mapQuote("X", { c: 0, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }, null, 0)).toBeNull();
  });

  it("maps candles and handles no_data", () => {
    expect(mapCandles({ s: "no_data" })).toEqual([]);
    expect(mapCandles({ s: "ok", t: [1, 2], c: [10.12345, 11] })).toEqual([
      { t: 1000, price: 10.1235 },
      { t: 2000, price: 11 },
    ]);
  });

  it("re-anchors a modeled series to the real last price", () => {
    const out = reanchor(
      [
        { t: 1, price: 100 },
        { t: 2, price: 110 },
      ],
      220,
    );
    expect(out).toEqual([
      { t: 1, price: 200 },
      { t: 2, price: 220 },
    ]);
    expect(reanchor([], 5)).toEqual([]);
  });

  it("anchors range windows to the latest session", () => {
    const w = rangeWindow("1D", edt(2026, 9, 19, 12));
    expect(w.resolution).toBe("15");
    expect(w.from).toBe(edt(2026, 9, 18, 9, 30));
    expect(w.to).toBe(edt(2026, 9, 18, 16));
    expect(rangeWindow("1Y", 0).resolution).toBe("D");
  });
});

describe("RateBudget", () => {
  it("allows up to the limit per window and then refuses", () => {
    const b = new RateBudget(3, 1000);
    expect(b.take(0)).toBe(true);
    expect(b.take(10)).toBe(true);
    expect(b.take(20)).toBe(true);
    expect(b.take(30)).toBe(false);
    expect(b.remaining(30)).toBe(0);
    expect(b.take(1001)).toBe(true); // first stamp expired
  });
});
