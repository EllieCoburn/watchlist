import {
  getMarketStatusAt,
  latestSessionOpen,
  nextSessionOpen,
  sessionClose,
  sessionOpen,
  toEastern,
} from "@/lib/market-data/market-hours";

export type HorizonInput = { type: "today" } | { type: "next" } | { type: "custom"; days: number };

/** One simulated session. `fraction` < 1 means the path starts part-way through (intraday entry). */
export type SessionSpec = {
  open: number;
  close: number;
  /** Portion of the session still ahead, 0–1. */
  fraction: number;
  /** Whether the session begins with an opening gap from the previous close. */
  hasGap: boolean;
  dateKey: string;
};

export type ResolvedHorizon = {
  sessions: SessionSpec[];
  /** Plain description, e.g. "the rest of today's session" or "the next 3 trading days". */
  label: string;
  /** Set when the request had to be adjusted (e.g. "Today" while the market is closed). */
  note: string | null;
  tradingDays: number;
  startsIntraday: boolean;
};

export const MAX_CUSTOM_DAYS = 30;

function spec(openMs: number, fraction: number, hasGap: boolean): SessionSpec {
  return {
    open: openMs,
    close: sessionClose(openMs),
    fraction,
    hasGap,
    dateKey: toEastern(openMs).dateKey,
  };
}

/** Turns a horizon choice into concrete sessions using the real US trading calendar. */
export function resolveHorizon(input: HorizonInput, now: number): ResolvedHorizon {
  const status = getMarketStatusAt(now);
  const isOpen = status.isOpen;
  const currentOpen = latestSessionOpen(now);
  const currentClose = sessionClose(currentOpen);
  const remaining = isOpen
    ? Math.max(0.02, (currentClose - now) / (currentClose - currentOpen))
    : 0;

  if (input.type === "today") {
    if (isOpen) {
      return {
        sessions: [spec(currentOpen, remaining, false)],
        label: "the rest of today's session",
        note: null,
        tradingDays: 1,
        startsIntraday: true,
      };
    }
    const next = nextSessionOpen(now);
    return {
      sessions: [spec(next, 1, true)],
      label: "the next trading session",
      note: "The market is closed, so “Today” has been treated as the next trading session, including its opening gap.",
      tradingDays: 1,
      startsIntraday: false,
    };
  }

  if (input.type === "next") {
    const next = isOpen ? nextSessionOpen(currentOpen) : nextSessionOpen(now);
    return {
      sessions: [spec(next, 1, true)],
      label: `the next trading session (${toEastern(next).dateKey})`,
      note: isOpen
        ? "Today's remaining session is not included; the simulation starts at tomorrow's open."
        : null,
      tradingDays: 1,
      startsIntraday: false,
    };
  }

  const days = Math.min(MAX_CUSTOM_DAYS, Math.max(1, Math.floor(input.days)));
  const sessions: SessionSpec[] = [];
  let cursor: number;
  if (isOpen) {
    sessions.push(spec(currentOpen, remaining, false));
    cursor = currentOpen;
  } else {
    cursor = nextSessionOpen(now);
    sessions.push(spec(cursor, 1, true));
  }
  while (sessions.length < days) {
    cursor = nextSessionOpen(cursor);
    sessions.push(spec(cursor, 1, true));
  }
  return {
    sessions,
    label: `the next ${days} trading ${days === 1 ? "day" : "days"}`,
    note: isOpen ? "Counts the rest of today as the first trading day." : null,
    tradingDays: days,
    startsIntraday: isOpen,
  };
}

/** Sessions between two instants — exposed for the earnings warning. */
export function sessionDatesBetween(fromMs: number, toMs: number): string[] {
  const keys: string[] = [];
  let cursor =
    sessionOpen(fromMs) <= fromMs
      ? latestSessionOpen(fromMs)
      : nextSessionOpen(fromMs - 86_400_000);
  for (let i = 0; i < 400 && cursor <= toMs; i++) {
    keys.push(toEastern(cursor).dateKey);
    cursor = nextSessionOpen(cursor);
  }
  return keys;
}
