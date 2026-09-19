import { describe, expect, it } from "vitest";
import {
  getMarketStatusAt,
  isTradingDay,
  latestSessionOpen,
  sessionClose,
  sessionOpen,
  toEastern,
} from "./market-hours";

// Helper: epoch ms for an Eastern wall-clock time (EDT = UTC-4 in September, EST = UTC-5 in January).
const edt = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 4, min);
const est = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h + 5, min);

describe("toEastern", () => {
  it("converts UTC to Eastern wall-clock with the right offset", () => {
    const et = toEastern(edt(2026, 9, 18, 10, 15));
    expect(et.hour).toBe(10);
    expect(et.minute).toBe(15);
    expect(et.weekday).toBe(5); // Friday
    expect(et.offsetMinutes).toBe(-240);
    expect(et.dateKey).toBe("2026-09-18");
  });
});

describe("getMarketStatusAt", () => {
  it("is open during a weekday session", () => {
    const s = getMarketStatusAt(edt(2026, 9, 18, 11));
    expect(s.state).toBe("open");
    expect(s.isOpen).toBe(true);
    expect(s.label).toBe("Market open");
  });

  it("is closed on a weekend", () => {
    const s = getMarketStatusAt(edt(2026, 9, 19, 12));
    expect(s.state).toBe("closed-weekend");
    expect(s.label).toBe("Market closed · Weekend");
    expect(s.nextChangeAt).toBe(sessionOpen(edt(2026, 9, 21, 12)));
  });

  it("is pre-market before 9:30 and after-hours after 16:00", () => {
    expect(getMarketStatusAt(edt(2026, 9, 18, 9, 29)).state).toBe("pre-market");
    expect(getMarketStatusAt(edt(2026, 9, 18, 9, 30)).state).toBe("open");
    expect(getMarketStatusAt(edt(2026, 9, 18, 15, 59)).state).toBe("open");
    expect(getMarketStatusAt(edt(2026, 9, 18, 16, 0)).state).toBe("after-hours");
  });

  it("knows exchange holidays", () => {
    expect(getMarketStatusAt(est(2026, 1, 19, 12)).state).toBe("closed-holiday");
    expect(isTradingDay(est(2026, 1, 20, 12))).toBe(true);
  });
});

describe("sessions", () => {
  it("computes open and close in Eastern time across DST", () => {
    expect(sessionOpen(edt(2026, 9, 18, 12))).toBe(edt(2026, 9, 18, 9, 30));
    expect(sessionClose(edt(2026, 9, 18, 12))).toBe(edt(2026, 9, 18, 16));
    expect(sessionOpen(est(2026, 1, 20, 12))).toBe(est(2026, 1, 20, 9, 30));
  });

  it("finds the latest session that has started", () => {
    // Saturday → Friday's session
    expect(latestSessionOpen(edt(2026, 9, 19, 12))).toBe(edt(2026, 9, 18, 9, 30));
    // Friday 8am → Thursday's session (Friday's has not opened yet)
    expect(latestSessionOpen(edt(2026, 9, 18, 8))).toBe(edt(2026, 9, 17, 9, 30));
    // Friday 10am → Friday's session
    expect(latestSessionOpen(edt(2026, 9, 18, 10))).toBe(edt(2026, 9, 18, 9, 30));
  });
});
