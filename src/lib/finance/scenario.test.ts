import { describe, expect, it } from "vitest";
import { formatMoney, formatSignedMoney } from "./money";
import { computeHypothetical, computeScenario, hypotheticalRange } from "./scenario";

const base = {
  ticker: "PLTR",
  entryPrice: 175,
  sizingMode: "amount" as const,
  amount: 10_000,
  shares: 0,
  targetPrice: 177,
  stopPrice: 174,
};

describe("computeScenario", () => {
  it("reproduces the PLTR example end to end", () => {
    const r = computeScenario(base);
    expect(r.valid).toBe(true);
    expect(r.shares).toBeCloseTo(57.142857, 5);
    expect(formatMoney(r.cost)).toBe("$10,000.00");
    expect(formatSignedMoney(r.target!.profit)).toBe("+$114.29");
    expect(formatSignedMoney(r.stop!.loss)).toBe("−$57.14");
    expect(r.riskReward).toBe(2);
    expect(formatMoney(r.target!.positionValue)).toBe("$10,114.29");
    expect(formatMoney(r.stop!.positionValue)).toBe("$9,942.86");
  });

  it("sizes by shares when asked", () => {
    const r = computeScenario({ ...base, sizingMode: "shares", shares: 10 });
    expect(r.shares).toBe(10);
    expect(r.cost).toBe(1750);
    expect(r.target!.profit).toBeCloseTo(20);
  });

  it("is invalid without a price or size", () => {
    expect(computeScenario({ ...base, entryPrice: 0 }).valid).toBe(false);
    expect(computeScenario({ ...base, amount: 0 }).valid).toBe(false);
    expect(computeScenario({ ...base, sizingMode: "shares", shares: 0 }).valid).toBe(false);
  });

  it("omits target/stop blocks when not provided", () => {
    const r = computeScenario({ ...base, targetPrice: null, stopPrice: null });
    expect(r.target).toBeNull();
    expect(r.stop).toBeNull();
    expect(r.riskReward).toBeNull();
  });
});

describe("computeHypothetical", () => {
  it("matches the “If PLTR reaches $178.00” example", () => {
    const h = computeHypothetical(10_000 / 175, 175, 178);
    expect(formatMoney(h.positionValue)).toBe("$10,171.43");
    expect(formatSignedMoney(h.profitLoss)).toBe("+$171.43");
    expect(h.returnPercent).toBeCloseTo(1.7142857, 5);
  });
});

describe("hypotheticalRange", () => {
  it("brackets the entry and always includes target and stop", () => {
    const r = hypotheticalRange(175, 220, 174);
    expect(r.min).toBeLessThanOrEqual(174);
    expect(r.max).toBeGreaterThanOrEqual(220);
    expect(r.step).toBe(0.1);
  });

  it("picks a coarser step for expensive stocks", () => {
    expect(hypotheticalRange(1200, null, null).step).toBe(0.5);
    expect(hypotheticalRange(3, null, null).step).toBe(0.01);
  });
});
