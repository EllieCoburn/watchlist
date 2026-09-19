import { describe, expect, it } from "vitest";
import { __mockInternals, MockMarketDataProvider } from "./mock";

const { buildQuote, buildSeries, priceAt } = __mockInternals;
const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);

const SATURDAY = edt(2026, 9, 19, 12, 12);
const FRIDAY_MIDDAY = edt(2026, 9, 18, 12, 0);

describe("mock provider: determinism", () => {
  it("returns identical quotes for identical inputs", () => {
    expect(buildQuote("AAPL", SATURDAY)).toEqual(buildQuote("AAPL", SATURDAY));
    expect(buildSeries("NVDA", "1D", SATURDAY)).toEqual(buildSeries("NVDA", "1D", SATURDAY));
  });

  it("gives different symbols different paths", () => {
    expect(buildQuote("AAPL", SATURDAY).price).not.toBe(buildQuote("MSFT", SATURDAY).price);
  });

  it("keeps known symbols near their base price", () => {
    const q = buildQuote("AAPL", SATURDAY);
    expect(q.price).toBeGreaterThan(336 * 0.85);
    expect(q.price).toBeLessThan(336 * 1.15);
    expect(q.companyName).toBe("Apple Inc");
  });

  it("handles unknown symbols without a name", () => {
    const q = buildQuote("ZZZZ", SATURDAY);
    expect(q.companyName).toBeNull();
    expect(q.price).toBeGreaterThan(0);
  });
});

describe("mock provider: quote consistency", () => {
  it("derives change from previous close and keeps price within the day range", () => {
    for (const symbol of ["AAPL", "NVDA", "PLTR", "BRK.B"]) {
      const q = buildQuote(symbol, FRIDAY_MIDDAY);
      expect(q.change).toBeCloseTo(q.price - q.previousClose, 3);
      expect(q.changePercent).toBeCloseTo((q.change / q.previousClose) * 100, 3);
      expect(q.dayLow).toBeLessThanOrEqual(q.price);
      expect(q.dayHigh).toBeGreaterThanOrEqual(q.price);
    }
  });

  it("is flat outside sessions: the weekend price equals Friday's close", () => {
    const fridayClose = priceAt("AAPL", edt(2026, 9, 18, 16));
    expect(priceAt("AAPL", SATURDAY)).toBe(fridayClose);
    expect(priceAt("AAPL", edt(2026, 9, 20, 18))).toBe(fridayClose);
  });

  it("lands the intraday path exactly on the close", () => {
    const series = buildSeries("MSFT", "1D", SATURDAY);
    const q = buildQuote("MSFT", SATURDAY);
    expect(series[series.length - 1].price).toBeCloseTo(q.price, 3);
  });
});

describe("mock provider: series shapes", () => {
  it("produces the expected number of points per range", () => {
    expect(buildSeries("AAPL", "live", SATURDAY)).toHaveLength(60);
    expect(buildSeries("AAPL", "1H", SATURDAY)).toHaveLength(31);
    expect(buildSeries("AAPL", "1D", SATURDAY)).toHaveLength(27);
    expect(buildSeries("AAPL", "1W", SATURDAY)).toHaveLength(5 * 8);
    expect(buildSeries("AAPL", "1M", SATURDAY)).toHaveLength(22);
    expect(buildSeries("AAPL", "1Y", SATURDAY)).toHaveLength(252);
  });

  it("truncates the 1D series at the current time while the market is open", () => {
    const series = buildSeries("AAPL", "1D", FRIDAY_MIDDAY);
    expect(series.length).toBe(11); // 9:30 → 12:00 is 150 minutes → 11 fifteen-minute samples
    expect(series[series.length - 1].t).toBe(FRIDAY_MIDDAY);
  });

  it("orders points by time", () => {
    const series = buildSeries("TSLA", "1W", SATURDAY);
    for (let i = 1; i < series.length; i++) expect(series[i].t).toBeGreaterThan(series[i - 1].t);
  });
});

describe("MockMarketDataProvider API", () => {
  const provider = new MockMarketDataProvider();

  it("searches and looks up symbols", async () => {
    expect((await provider.searchSymbols("ap"))[0].symbol).toBe("AAPL");
    expect(await provider.lookupSymbol("nvda")).toEqual({
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
    });
    expect(await provider.lookupSymbol("ZZZZ")).toBeNull();
  });

  it("reports a market status", async () => {
    const status = await provider.getMarketStatus(new Date(SATURDAY));
    expect(status.isOpen).toBe(false);
    expect(status.label).toBe("Market closed · Weekend");
  });
});
