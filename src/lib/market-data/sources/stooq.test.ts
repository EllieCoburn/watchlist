import { describe, expect, it } from "vitest";
import { parseStooqCsv, toStooqSymbol } from "./stooq";

describe("stooq", () => {
  it("maps symbols to Stooq's naming", () => {
    expect(toStooqSymbol("AAPL")).toBe("aapl.us");
    expect(toStooqSymbol("BRK.B")).toBe("brk-b.us");
  });

  it("parses daily CSV into close-time points in order", () => {
    const csv =
      "Date,Open,High,Low,Close,Volume\n2026-09-18,337.5,338.49,332.53,336.13,1\n2026-09-17,336,339,335,337.9,1\nbad,line\n";
    const pts = parseStooqCsv(csv);
    expect(pts).toHaveLength(2);
    expect(pts[0].price).toBe(337.9);
    expect(pts[1].price).toBe(336.13);
    expect(pts[0].t).toBeLessThan(pts[1].t);
    // 16:00 ET on 18 Sept 2026 = 20:00 UTC
    expect(pts[1].t).toBe(Date.UTC(2026, 8, 18, 20));
  });

  it("returns nothing for an error page or empty body", () => {
    expect(parseStooqCsv("No data")).toEqual([]);
    expect(parseStooqCsv("")).toEqual([]);
  });
});
