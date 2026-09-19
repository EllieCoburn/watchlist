import type { MarketStatus } from "./types";

/**
 * US equity market hours (NYSE / Nasdaq): 9:30–16:00 America/New_York, Monday–Friday,
 * excluding the exchange holidays listed below. Pure functions, no provider needed.
 */

export const SESSION_OPEN_MINUTES = 9 * 60 + 30;
export const SESSION_CLOSE_MINUTES = 16 * 60;
export const SESSION_LENGTH_MINUTES = SESSION_CLOSE_MINUTES - SESSION_OPEN_MINUTES; // 390

const HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01",
  "2025-01-09",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

const DAY_MS = 86_400_000;

const etFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

export type EasternTime = {
  year: number;
  month: number; // 1–12
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  /** Minutes to add to UTC to get Eastern wall-clock time (negative). */
  offsetMinutes: number;
  /** "YYYY-MM-DD" in Eastern time. */
  dateKey: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toEastern(ts: number): EasternTime {
  const parts = Object.fromEntries(
    etFormatter.formatToParts(new Date(ts)).map((p) => [p.type, p.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((wallAsUtc - Math.floor(ts / 1000) * 1000) / 60_000);
  return {
    year,
    month,
    day,
    weekday: WEEKDAYS.indexOf(parts.weekday),
    hour,
    minute,
    second,
    offsetMinutes,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Epoch ms for a given Eastern wall-clock minute on the Eastern calendar day containing `ts`. */
export function easternWallClock(ts: number, minutesSinceMidnight: number): number {
  const et = toEastern(ts);
  const h = Math.floor(minutesSinceMidnight / 60);
  const m = minutesSinceMidnight % 60;
  // First guess using the current offset, then correct for DST edges.
  let guess = Date.UTC(et.year, et.month - 1, et.day, h, m) - et.offsetMinutes * 60_000;
  const check = toEastern(guess);
  if (check.hour !== h || check.minute !== m) {
    guess = Date.UTC(et.year, et.month - 1, et.day, h, m) - check.offsetMinutes * 60_000;
  }
  return guess;
}

export function isTradingDay(ts: number): boolean {
  const et = toEastern(ts);
  if (et.weekday === 0 || et.weekday === 6) return false;
  return !HOLIDAYS.has(et.dateKey);
}

export function sessionOpen(ts: number): number {
  return easternWallClock(ts, SESSION_OPEN_MINUTES);
}

export function sessionClose(ts: number): number {
  return easternWallClock(ts, SESSION_CLOSE_MINUTES);
}

/** Start (session open) of the most recent trading session that has begun at or before `ts`. */
export function latestSessionOpen(ts: number): number {
  let cursor = ts;
  for (let i = 0; i < 15; i++) {
    if (isTradingDay(cursor) && sessionOpen(cursor) <= ts) return sessionOpen(cursor);
    cursor -= DAY_MS;
  }
  return sessionOpen(cursor);
}

/** Session open of the trading day `n` sessions before the one containing `sessionTs`. */
export function previousSessionOpen(sessionTs: number, n = 1): number {
  let cursor = sessionTs;
  let remaining = n;
  while (remaining > 0) {
    cursor -= DAY_MS;
    if (isTradingDay(cursor)) remaining--;
  }
  return sessionOpen(cursor);
}

/** Session open of the first trading day strictly after the day containing `ts`. */
export function nextSessionOpen(ts: number): number {
  let cursor = ts + DAY_MS;
  for (let i = 0; i < 15; i++) {
    if (isTradingDay(cursor)) return sessionOpen(cursor);
    cursor += DAY_MS;
  }
  return sessionOpen(cursor);
}

export function getMarketStatusAt(ts: number): MarketStatus {
  const et = toEastern(ts);
  const minutes = et.hour * 60 + et.minute;

  if (et.weekday === 0 || et.weekday === 6) {
    return {
      state: "closed-weekend",
      isOpen: false,
      label: "Market closed · Weekend",
      nextChangeAt: nextSessionOpen(ts),
    };
  }
  if (HOLIDAYS.has(et.dateKey)) {
    return {
      state: "closed-holiday",
      isOpen: false,
      label: "Market closed · Holiday",
      nextChangeAt: nextSessionOpen(ts),
    };
  }
  if (minutes < SESSION_OPEN_MINUTES) {
    return {
      state: "pre-market",
      isOpen: false,
      label: "Market closed · Pre-market",
      nextChangeAt: sessionOpen(ts),
    };
  }
  if (minutes < SESSION_CLOSE_MINUTES) {
    return { state: "open", isOpen: true, label: "Market open", nextChangeAt: sessionClose(ts) };
  }
  return {
    state: "after-hours",
    isOpen: false,
    label: "Market closed · After hours",
    nextChangeAt: nextSessionOpen(ts),
  };
}
