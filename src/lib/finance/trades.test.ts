import { describe, expect, it } from "vitest";
import {
  combineDateTime,
  filterTrades,
  sortTrades,
  tradeCapital,
  tradeHolding,
  tradeOutcome,
  tradePlannedReward,
  tradePlannedRisk,
  tradeRealizedPnl,
  tradeReturnPercent,
  tradeRiskReward,
  type Trade,
} from "./trades";

function trade(overrides: Partial<Trade>): Trade {
  return {
    id: overrides.id ?? "t",
    ticker: "PLTR",
    companyName: "Palantir Technologies",
    status: "closed",
    entryPrice: 175,
    entryDate: "2026-09-01",
    entryTime: "09:45",
    shares: 57.1429,
    capital: 10_000,
    targetPrice: 177,
    stopPrice: 174,
    exitPrice: 177.4,
    exitDate: "2026-09-03",
    exitTime: "15:30",
    notes: null,
    entryReason: null,
    reflection: null,
    followedPlan: null,
    improvement: null,
    scenarioId: null,
    createdAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-03T20:00:00Z",
    ...overrides,
  };
}

describe("derived trade metrics", () => {
  it("computes realized P/L, return and outcome for a closed trade", () => {
    const t = trade({});
    expect(tradeRealizedPnl(t)).toBeCloseTo(137.14, 1);
    expect(tradeReturnPercent(t)).toBeCloseTo(1.3714, 3);
    expect(tradeOutcome(t)).toBe("win");
  });

  it("has no realized P/L for open or planned trades", () => {
    expect(tradeRealizedPnl(trade({ status: "open", exitPrice: null }))).toBeNull();
    expect(tradeRealizedPnl(trade({ status: "planned" }))).toBeNull();
    expect(tradeOutcome(trade({ status: "open" }))).toBeNull();
  });

  it("treats a sub-cent difference as break-even", () => {
    expect(tradeOutcome(trade({ exitPrice: 175.00001 }))).toBe("breakeven");
    expect(tradeOutcome(trade({ exitPrice: 170 }))).toBe("loss");
  });

  it("computes planned risk, reward and ratio", () => {
    const t = trade({});
    expect(tradePlannedRisk(t)).toBeCloseTo(57.14, 1);
    expect(tradePlannedReward(t)).toBeCloseTo(114.29, 1);
    expect(tradeRiskReward(t)).toBeCloseTo(2, 5);
    expect(tradeRiskReward(trade({ stopPrice: null }))).toBeNull();
    expect(tradeRiskReward(trade({ stopPrice: 180 }))).toBeNull();
  });

  it("prefers entered capital, falling back to shares × entry", () => {
    expect(tradeCapital(trade({}))).toBe(10_000);
    expect(tradeCapital(trade({ capital: null }))).toBeCloseTo(10_000, 0);
    expect(tradeCapital(trade({ capital: null, shares: null }))).toBeNull();
  });

  it("computes holding duration with times", () => {
    expect(tradeHolding(trade({}))?.label).toBe("2 days");
    expect(tradeHolding(trade({ status: "open", exitDate: null }))).toBeNull();
  });
});

describe("combineDateTime", () => {
  it("combines date and time in local time", () => {
    const d = combineDateTime("2026-09-01", "09:45");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(1);
    expect(d?.getHours()).toBe(9);
    expect(d?.getMinutes()).toBe(45);
    expect(combineDateTime(null, "09:45")).toBeNull();
    expect(combineDateTime("2026-09-01", null)?.getHours()).toBe(0);
  });
});

describe("filterTrades / sortTrades", () => {
  const trades = [
    trade({ id: "a", ticker: "AAPL", status: "open", exitPrice: null, entryDate: "2026-09-10" }),
    trade({ id: "b", ticker: "PLTR", exitPrice: 177.4, exitDate: "2026-09-03" }), // +137
    trade({
      id: "c",
      ticker: "NVDA",
      entryPrice: 200,
      exitPrice: 190,
      shares: 10,
      exitDate: "2026-09-05",
    }), // -100
    trade({
      id: "d",
      ticker: "MSFT",
      status: "planned",
      entryDate: null,
      createdAt: "2026-09-12T00:00:00Z",
    }),
  ];

  it("filters by status and ticker", () => {
    expect(filterTrades(trades, "open", "").map((t) => t.id)).toEqual(["a"]);
    expect(filterTrades(trades, "closed", "").map((t) => t.id)).toEqual(["b", "c"]);
    expect(filterTrades(trades, "all", "nv").map((t) => t.id)).toEqual(["c"]);
  });

  it("sorts newest, oldest, largest win and largest loss", () => {
    expect(sortTrades(trades, "newest").map((t) => t.id)).toEqual(["d", "a", "c", "b"]);
    expect(sortTrades(trades, "oldest").map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
    expect(
      sortTrades(trades, "largest-win")
        .map((t) => t.id)
        .slice(0, 2),
    ).toEqual(["b", "c"]);
    expect(
      sortTrades(trades, "largest-loss")
        .map((t) => t.id)
        .slice(0, 2),
    ).toEqual(["c", "b"]);
  });
});
