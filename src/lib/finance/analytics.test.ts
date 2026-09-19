import { describe, expect, it } from "vitest";
import {
  bestTickers,
  mostTradedTickers,
  performanceOverTime,
  summarizeTrades,
  tickerStats,
  worstTickers,
} from "./analytics";
import type { Trade } from "./trades";

function trade(o: Partial<Trade>): Trade {
  return {
    id: Math.random().toString(36).slice(2),
    ticker: "AAA",
    companyName: null,
    status: "closed",
    entryPrice: 100,
    entryDate: "2026-09-01",
    entryTime: null,
    shares: 10,
    capital: 1000,
    targetPrice: 110,
    stopPrice: 95,
    exitPrice: 110,
    exitDate: "2026-09-02",
    exitTime: null,
    notes: null,
    entryReason: null,
    reflection: null,
    followedPlan: null,
    improvement: null,
    scenarioId: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    ...o,
  };
}

const TRADES: Trade[] = [
  trade({ ticker: "AAA", exitPrice: 110, exitDate: "2026-09-02" }), // +100, 2:1
  trade({ ticker: "BBB", exitPrice: 95, exitDate: "2026-09-03" }), // -50
  trade({ ticker: "AAA", exitPrice: 130, exitDate: "2026-09-04" }), // +300
  trade({ ticker: "CCC", exitPrice: 100, exitDate: "2026-09-04" }), // 0 (break-even)
  trade({ ticker: "BBB", status: "open", exitPrice: null, exitDate: null }), // ignored
  trade({ ticker: "DDD", status: "planned", entryPrice: null, shares: null, exitPrice: null }), // ignored
];

describe("summarizeTrades", () => {
  it("computes the headline metrics from closed trades only", () => {
    const s = summarizeTrades(TRADES);
    expect(s.closedCount).toBe(4);
    expect(s.totalRealized).toBeCloseTo(350);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.breakeven).toBe(1);
    expect(s.winRate).toBeCloseTo(0.5);
    expect(s.averageWinner).toBeCloseTo(200);
    expect(s.averageLoser).toBeCloseTo(-50);
    expect(s.largestWinner).toBeCloseTo(300);
    expect(s.largestLoser).toBeCloseTo(-50);
    expect(s.averageReturnPercent).toBeCloseTo((10 - 5 + 30 + 0) / 4);
    expect(s.averageRiskReward).toBeCloseTo(2);
    expect(s.expectancy).toBeCloseTo(0.5 * 200 - 0.5 * 50);
  });

  it("returns nulls with no closed trades", () => {
    const s = summarizeTrades([trade({ status: "open", exitPrice: null })]);
    expect(s.closedCount).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.averageWinner).toBeNull();
    expect(s.expectancy).toBeNull();
    expect(s.totalRealized).toBe(0);
  });
});

describe("performanceOverTime", () => {
  it("accumulates realized P/L by exit date in order", () => {
    const points = performanceOverTime(TRADES);
    expect(points.map((p) => p.date)).toEqual(["2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(points.map((p) => p.realized)).toEqual([100, -50, 300]);
    expect(points.map((p) => p.cumulative)).toEqual([100, 50, 350]);
  });
});

describe("ticker breakdowns", () => {
  const stats = tickerStats(TRADES);

  it("aggregates per ticker", () => {
    const aaa = stats.find((s) => s.ticker === "AAA")!;
    expect(aaa.trades).toBe(2);
    expect(aaa.closed).toBe(2);
    expect(aaa.realized).toBeCloseTo(400);
    expect(aaa.wins).toBe(2);
    const bbb = stats.find((s) => s.ticker === "BBB")!;
    expect(bbb.trades).toBe(2);
    expect(bbb.closed).toBe(1);
  });

  it("ranks best, worst and most traded", () => {
    expect(bestTickers(stats).map((s) => s.ticker)).toEqual(["AAA"]);
    expect(worstTickers(stats).map((s) => s.ticker)).toEqual(["BBB"]);
    expect(mostTradedTickers(stats, 2).map((s) => s.ticker)).toEqual(["AAA", "BBB"]);
  });
});
