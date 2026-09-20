/**
 * Scheduled events inside a horizon. Earnings come from the market-data provider. Fed
 * decision days are a static list of FOMC meeting second days for 2026; verify against
 * federalreserve.gov before relying on them (a wrong entry only affects a warning).
 */

export const FOMC_DECISION_DATES_2026 = [
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
];

export type EventFlag = { kind: "earnings" | "fomc"; date: string; message: string };

export function eventsInHorizon(sessionDates: string[], earningsDate: string | null): EventFlag[] {
  const flags: EventFlag[] = [];
  if (earningsDate && sessionDates.includes(earningsDate)) {
    flags.push({
      kind: "earnings",
      date: earningsDate,
      message: `Earnings are scheduled on ${earningsDate}, inside the simulated period. Historical volatility understates event moves; this model does not simulate earnings.`,
    });
  }
  for (const d of FOMC_DECISION_DATES_2026) {
    if (sessionDates.includes(d))
      flags.push({
        kind: "fomc",
        date: d,
        message: `A Federal Reserve decision is scheduled on ${d}, inside the simulated period. Market-wide volatility is typically higher that afternoon.`,
      });
  }
  return flags;
}
