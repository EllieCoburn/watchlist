import { describe, expect, it } from "vitest";
import {
  MINUS,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  formatSignedNumber,
  formatSignedPercent,
  roundMoney,
  roundTo,
} from "./money";

describe("roundTo / roundMoney", () => {
  it("rounds to the requested precision", () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(roundTo(1.23456, 3)).toBe(1.235);
  });

  it("avoids classic floating point artefacts", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney((10000 / 175) * 177 - 10000)).toBe(114.29);
  });

  it("returns 0 for non-finite input", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats positive and negative currency", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(-57.14)).toBe(`${MINUS}$57.14`);
  });

  it("never prints negative zero", () => {
    expect(formatMoney(-0.001)).toBe("$0.00");
  });
});

describe("formatSignedMoney", () => {
  it("always shows a sign for non-zero values", () => {
    expect(formatSignedMoney(114.28)).toBe("+$114.28");
    expect(formatSignedMoney(-57.14)).toBe(`${MINUS}$57.14`);
    expect(formatSignedMoney(0)).toBe("$0.00");
  });
});

describe("formatPrice / formatSignedNumber / formatSignedPercent", () => {
  it("matches the stock card reference", () => {
    expect(formatPrice(336.13)).toBe("336.13");
    expect(formatSignedNumber(-1.77)).toBe(`${MINUS}1.77`);
    expect(formatSignedPercent(-0.53)).toBe(`${MINUS}0.53%`);
    expect(formatSignedNumber(2.92)).toBe("+2.92");
    expect(formatSignedPercent(1.33)).toBe("+1.33%");
    expect(formatSignedPercent(0)).toBe("0.00%");
  });
});

describe("formatPercent / formatShares", () => {
  it("formats plain percentages", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
    expect(formatPercent(-0.04)).toBe("0.0%");
  });

  it("formats whole and fractional shares", () => {
    expect(formatShares(57)).toBe("57");
    expect(formatShares(57.142857)).toBe("57.14");
    expect(formatShares(1500)).toBe("1,500");
  });
});
