import { describe, expect, it } from "vitest";
import { mapPolygonAggs } from "./polygon";

describe("polygon", () => {
  it("maps aggregates with lows and highs, sorted by time", () => {
    const pts = mapPolygonAggs([
      { t: 2000, o: 1, h: 12, l: 9, c: 10.12345, v: 1 },
      { t: 1000, o: 1, h: 11, l: 8, c: 9, v: 1 },
      { t: 3000, o: 1, h: 0, l: 0, c: 0, v: 1 },
    ]);
    expect(pts).toEqual([
      { t: 1000, price: 9, low: 8, high: 11 },
      { t: 2000, price: 10.1235, low: 9, high: 12 },
    ]);
  });

  it("handles a missing results array", () => {
    expect(mapPolygonAggs(undefined)).toEqual([]);
  });
});
