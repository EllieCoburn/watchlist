import { describe, expect, it } from "vitest";
import { mapBars, mapSnapshotToQuote, rangeWindow, timeframeForSpan } from "./alpaca";

const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);

describe("alpaca mapping", () => {
  it("maps a snapshot to a quote", () => {
    const q = mapSnapshotToQuote(
      "AAPL",
      {
        latestTrade: { p: 336.13, t: "2026-09-18T19:59:58Z" },
        dailyBar: { t: "2026-09-18T04:00:00Z", o: 337.5, h: 338.49, l: 332.53, c: 336.13, v: 1 },
        prevDailyBar: { t: "2026-09-17T04:00:00Z", o: 336, h: 339, l: 335, c: 337.9, v: 1 },
      },
      "Apple Inc",
      0,
    );
    expect(q).not.toBeNull();
    expect(q!.price).toBe(336.13);
    expect(q!.previousClose).toBe(337.9);
    expect(q!.change).toBeCloseTo(-1.77, 4);
    expect(q!.changePercent).toBeCloseTo(-0.5238, 3);
    expect(q!.dayLow).toBe(332.53);
    expect(q!.dayHigh).toBe(338.49);
    expect(q!.asOf).toBe(Date.parse("2026-09-18T19:59:58Z"));
  });

  it("returns null without a usable price or previous close", () => {
    expect(mapSnapshotToQuote("X", {}, null, 0)).toBeNull();
    expect(
      mapSnapshotToQuote("X", { latestTrade: { p: 10, t: "2026-01-01T00:00:00Z" } }, null, 0),
    ).toBeNull();
  });

  it("maps bars to price points in order and drops bad timestamps", () => {
    const pts = mapBars([
      { t: "2026-09-18T13:30:00Z", o: 1, h: 1, l: 1, c: 100.123456, v: 1 },
      { t: "not-a-date", o: 1, h: 1, l: 1, c: 1, v: 1 },
      { t: "2026-09-18T13:45:00Z", o: 1, h: 1, l: 1, c: 101, v: 1 },
    ]);
    expect(pts).toEqual([
      { t: Date.parse("2026-09-18T13:30:00Z"), price: 100.1235 },
      { t: Date.parse("2026-09-18T13:45:00Z"), price: 101 },
    ]);
  });
});

describe("alpaca range windows", () => {
  it("anchors intraday ranges to the latest session", () => {
    const saturday = edt(2026, 9, 19, 12);
    const d = rangeWindow("1D", saturday);
    expect(d.timeframe).toBe("15Min");
    expect(d.start).toBe(edt(2026, 9, 18, 9, 30));
    expect(d.end).toBe(edt(2026, 9, 18, 16));

    const h = rangeWindow("1H", saturday);
    expect(h.timeframe).toBe("1Min");
    expect(h.start).toBe(edt(2026, 9, 18, 15));
    expect(h.end).toBe(edt(2026, 9, 18, 16));

    const w = rangeWindow("1W", saturday);
    expect(w.timeframe).toBe("1Hour");
    expect(w.start).toBe(edt(2026, 9, 14, 9, 30));
  });

  it("uses daily bars for long ranges", () => {
    expect(rangeWindow("1M", 0).timeframe).toBe("1Day");
    expect(rangeWindow("1Y", 0).timeframe).toBe("1Day");
  });

  it("picks a timeframe by span", () => {
    expect(timeframeForSpan(2 * 3_600_000)).toBe("15Min");
    expect(timeframeForSpan(5 * 86_400_000)).toBe("1Hour");
    expect(timeframeForSpan(60 * 86_400_000)).toBe("1Day");
  });
});
