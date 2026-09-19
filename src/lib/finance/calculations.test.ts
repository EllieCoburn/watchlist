import { describe, expect, it } from "vitest";
import {
  calculateExpectancy,
  calculateHoldingDuration,
  calculatePositionValue,
  calculateProfitLoss,
  calculateReturnPercentage,
  calculateRiskReward,
  calculateShares,
  calculateStopLoss,
  calculateTargetProfit,
} from "./calculations";
import { formatMoney, formatShares, formatSignedMoney, roundMoney } from "./money";

// The PLTR example from the product brief.
const ENTRY = 175;
const CAPITAL = 10_000;
const TARGET = 177;
const STOP = 174;
const SHARES = calculateShares(CAPITAL, ENTRY);

describe("calculateShares / calculatePositionValue", () => {
  it("allows fractional shares", () => {
    expect(SHARES).toBeCloseTo(57.142857, 5);
    expect(formatShares(SHARES)).toBe("57.14");
  });

  it("returns the invested capital at the entry price", () => {
    expect(roundMoney(calculatePositionValue(SHARES, ENTRY))).toBe(10_000);
  });

  it("guards against zero and negative input", () => {
    expect(calculateShares(0, 100)).toBe(0);
    expect(calculateShares(100, 0)).toBe(0);
    expect(calculateShares(-5, 10)).toBe(0);
    expect(calculatePositionValue(-1, 10)).toBe(0);
  });
});

describe("calculateProfitLoss / target / stop", () => {
  it("matches the PLTR example", () => {
    expect(formatSignedMoney(calculateTargetProfit(SHARES, ENTRY, TARGET))).toBe("+$114.29");
    expect(formatSignedMoney(calculateStopLoss(SHARES, ENTRY, STOP))).toBe("−$57.14");
    expect(formatMoney(calculatePositionValue(SHARES, 178))).toBe("$10,171.43");
    expect(formatSignedMoney(calculateProfitLoss(SHARES, ENTRY, 178))).toBe("+$171.43");
  });

  it("is zero when nothing moved", () => {
    expect(calculateProfitLoss(10, 50, 50)).toBe(0);
  });
});

describe("calculateReturnPercentage", () => {
  it("returns a percentage, not a ratio", () => {
    expect(calculateReturnPercentage(100, 110)).toBeCloseTo(10);
    expect(calculateReturnPercentage(ENTRY, TARGET)).toBeCloseTo(1.142857, 5);
    expect(calculateReturnPercentage(ENTRY, STOP)).toBeCloseTo(-0.571428, 5);
  });

  it("returns 0 for an invalid entry price", () => {
    expect(calculateReturnPercentage(0, 10)).toBe(0);
  });
});

describe("calculateRiskReward", () => {
  it("matches the example: 2.0 : 1", () => {
    expect(calculateRiskReward(ENTRY, TARGET, STOP)).toBe(2);
  });

  it("is null when the plan is malformed", () => {
    expect(calculateRiskReward(100, 90, 95)).toBeNull(); // target below entry
    expect(calculateRiskReward(100, 110, 105)).toBeNull(); // stop above entry
    expect(calculateRiskReward(100, 110, 100)).toBeNull(); // no risk at all
  });
});

describe("calculateExpectancy", () => {
  it("weights average win and loss by win rate", () => {
    expect(calculateExpectancy(0.5, 100, 50)).toBe(25);
    expect(calculateExpectancy(0.4, 200, 100)).toBeCloseTo(20);
    expect(calculateExpectancy(1, 50, 999)).toBe(50);
    expect(calculateExpectancy(0, 50, 20)).toBe(-20);
  });

  it("treats a negative average loss as a magnitude", () => {
    expect(calculateExpectancy(0.5, 100, -50)).toBe(25);
  });

  it("returns 0 for an invalid win rate", () => {
    expect(calculateExpectancy(1.5, 100, 50)).toBe(0);
  });
});

describe("calculateHoldingDuration", () => {
  const at = (iso: string) => new Date(iso);

  it("labels durations in plain language", () => {
    expect(
      calculateHoldingDuration(at("2026-09-01T10:00:00Z"), at("2026-09-01T10:00:30Z")).label,
    ).toBe("under a minute");
    expect(
      calculateHoldingDuration(at("2026-09-01T10:00:00Z"), at("2026-09-01T10:45:00Z")).label,
    ).toBe("45 minutes");
    expect(
      calculateHoldingDuration(at("2026-09-01T10:00:00Z"), at("2026-09-01T15:00:00Z")).label,
    ).toBe("5 hours");
    expect(
      calculateHoldingDuration(at("2026-09-01T10:00:00Z"), at("2026-09-02T10:00:00Z")).label,
    ).toBe("1 day");
    expect(calculateHoldingDuration(at("2026-09-01"), at("2026-09-04")).label).toBe("3 days");
    expect(calculateHoldingDuration(at("2026-09-01"), at("2026-09-22")).label).toBe("3 weeks");
    expect(calculateHoldingDuration(at("2026-01-01"), at("2026-04-01")).label).toBe("3 months");
    expect(calculateHoldingDuration(at("2024-01-01"), at("2026-01-01")).label).toBe("2 years");
  });

  it("never goes negative", () => {
    expect(calculateHoldingDuration(at("2026-09-04"), at("2026-09-01")).milliseconds).toBe(0);
  });
});
