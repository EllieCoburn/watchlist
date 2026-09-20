import { SESSION_CLOSE_MINUTES, SESSION_OPEN_MINUTES, toEastern } from "./market-hours";
import type { IntradayBar, IntradaySession } from "./types";

/**
 * Groups intraday bars into regular-hours sessions keyed by Eastern date. Bars outside
 * 09:30–16:00 ET (pre/post market) are dropped; sessions with too few bars are dropped.
 */
export function groupIntoSessions(bars: IntradayBar[], intervalMinutes: number): IntradaySession[] {
  const expected = Math.floor((SESSION_CLOSE_MINUTES - SESSION_OPEN_MINUTES) / intervalMinutes);
  const map = new Map<string, IntradayBar[]>();
  for (const b of bars) {
    const et = toEastern(b.t);
    const minute = et.hour * 60 + et.minute;
    if (minute < SESSION_OPEN_MINUTES || minute >= SESSION_CLOSE_MINUTES) continue;
    if (!(b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0)) continue;
    const list = map.get(et.dateKey) ?? [];
    list.push(b);
    map.set(et.dateKey, list);
  }
  const sessions: IntradaySession[] = [];
  for (const [dateKey, list] of map) {
    list.sort((a, b) => a.t - b.t);
    // Keep sessions with at least 80% of the expected bars (half-days are excluded on purpose).
    if (list.length < Math.floor(expected * 0.8)) continue;
    sessions.push({ dateKey, bars: list, intervalMinutes });
  }
  sessions.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return sessions;
}
