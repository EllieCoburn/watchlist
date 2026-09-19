import { describe, expect, it } from "vitest";
import { parseYahooChart, toYahooSymbol, yahooParams } from "./yahoo";

describe("yahoo", () => {
  it("maps symbols", () => {
    expect(toYahooSymbol("brk.b")).toBe("BRK-B");
  });

  it("parses a chart payload and skips null bars", () => {
    const pts = parseYahooChart({
      chart: {
        result: [
          {
            timestamp: [1, 2, 3],
            indicators: {
              quote: [
                { close: [100, null, 102.123456], low: [99, null, 101], high: [101, null, 103] },
              ],
            },
          },
        ],
      },
    });
    expect(pts).toEqual([
      { t: 1000, price: 100, low: 99, high: 101 },
      { t: 3000, price: 102.1235, low: 101, high: 103 },
    ]);
  });

  it("returns nothing for an error payload", () => {
    expect(parseYahooChart({ chart: { result: undefined, error: { code: "Not Found" } } })).toEqual(
      [],
    );
  });

  it("chooses sensible range and interval pairs", () => {
    expect(yahooParams("1D")).toEqual({ range: "1d", interval: "5m" });
    expect(yahooParams("1Y")).toEqual({ range: "1y", interval: "1d" });
  });
});
