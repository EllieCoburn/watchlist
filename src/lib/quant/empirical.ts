import type { DailyBar } from "@/lib/market-data/types";
import { std } from "./stats";

/**
 * Historical empirical analysis: in comparable past sessions, how often did the stock move
 * far enough to touch the target / stop, measured as a percentage of the session's starting
 * price (never as absolute price levels, which mislead when past prices were different).
 */

export type EmpiricalResult = {
  sessions: number;
  sessionsAvailable: number;
  regimeFiltered: boolean;
  horizonDays: number;
  /** "prevClose" for full sessions (gap included), "open" for intraday starts. */
  reference: "prevClose" | "open";
  counts: {
    target: number;
    stop: number;
    both: number;
    neither: number;
    targetFirst: number;
    stopFirst: number;
  };
  rates: {
    target: number;
    stop: number;
    both: number;
    neither: number;
    targetFirst: number;
    stopFirst: number;
  };
  /** Share of windows that touched both where the order had to be inferred from the open/close direction. */
  orderInferredShare: number;
  medianUpExcursion: number;
  medianDownExcursion: number;
};

type Window = { up: number; down: number; upFirst: boolean | null; inferred: boolean };

/** OHLC heuristic for a bar that touched both levels: an up day is assumed to visit its low first. */
function highFirst(bar: DailyBar): boolean {
  return bar.close < bar.open;
}

function buildWindows(
  bars: DailyBar[],
  upNeeded: number,
  downNeeded: number,
  n: number,
  startsIntraday: boolean,
  keep: (barIndex: number) => boolean,
): Window[] {
  const windows: Window[] = [];
  for (let i = 1; i + n - 1 < bars.length; i++) {
    if (!keep(i)) continue;
    const ref = startsIntraday ? bars[i].open : bars[i - 1].close;
    if (!(ref > 0)) continue;
    let up = -Infinity;
    let down = Infinity;
    let upFirst: boolean | null = null;
    let inferred = false;
    let decided = false;
    for (let d = 0; d < n; d++) {
      const b = bars[i + d];
      const hi = Math.log(b.high / ref);
      const lo = Math.log(b.low / ref);
      if (hi > up) up = hi;
      if (lo < down) down = lo;
      if (decided) continue;
      const hitT = hi >= upNeeded;
      const hitS = lo <= downNeeded;
      if (hitT && hitS) {
        const open = Math.log(b.open / ref);
        const gapApplies = d > 0 || !startsIntraday;
        if (gapApplies && open >= upNeeded) upFirst = true;
        else if (gapApplies && open <= downNeeded) upFirst = false;
        else {
          upFirst = highFirst(b);
          inferred = true;
        }
        decided = true;
      } else if (hitT) {
        upFirst = true;
        decided = true;
      } else if (hitS) {
        upFirst = false;
        decided = true;
      }
    }
    windows.push({ up, down, upFirst, inferred });
  }
  return windows;
}

export function empiricalBarrierAnalysis(
  bars: DailyBar[],
  targetPct: number,
  stopPct: number,
  horizonDays: number,
  startsIntraday: boolean,
  opts: { regimeFilter?: { currentVol: number; band: [number, number]; minSessions: number } } = {},
): EmpiricalResult {
  const upNeeded = Math.log(1 + targetPct);
  const downNeeded = Math.log(1 + stopPct);
  const n = Math.max(1, horizonDays);

  const rets: number[] = [];
  for (let i = 1; i < bars.length; i++) rets.push(Math.log(bars[i].close / bars[i - 1].close));
  const trailingVol = (i: number): number | null =>
    i >= 21 ? std(rets.slice(i - 21, i - 1)) : null;

  const all = buildWindows(bars, upNeeded, downNeeded, n, startsIntraday, () => true);
  let windows = all;
  let regimeFiltered = false;
  if (opts.regimeFilter) {
    const { currentVol, band, minSessions } = opts.regimeFilter;
    const filtered = buildWindows(bars, upNeeded, downNeeded, n, startsIntraday, (i) => {
      const v = trailingVol(i);
      return v != null && v >= currentVol * band[0] && v <= currentVol * band[1];
    });
    if (filtered.length >= minSessions) {
      windows = filtered;
      regimeFiltered = true;
    }
  }

  const counts = { target: 0, stop: 0, both: 0, neither: 0, targetFirst: 0, stopFirst: 0 };
  let inferred = 0;
  for (const w of windows) {
    const t = w.up >= upNeeded;
    const s = w.down <= downNeeded;
    if (t) counts.target++;
    if (s) counts.stop++;
    if (t && s) {
      counts.both++;
      if (w.inferred) inferred++;
    }
    if (!t && !s) counts.neither++;
    if (w.upFirst === true) counts.targetFirst++;
    if (w.upFirst === false) counts.stopFirst++;
  }
  const total = windows.length || 1;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };

  return {
    sessions: windows.length,
    sessionsAvailable: all.length,
    regimeFiltered,
    horizonDays: n,
    reference: startsIntraday ? "open" : "prevClose",
    counts,
    rates: {
      target: counts.target / total,
      stop: counts.stop / total,
      both: counts.both / total,
      neither: counts.neither / total,
      targetFirst: counts.targetFirst / total,
      stopFirst: counts.stopFirst / total,
    },
    orderInferredShare: counts.both ? inferred / counts.both : 0,
    medianUpExcursion: Math.expm1(median(windows.map((w) => w.up))),
    medianDownExcursion: Math.expm1(median(windows.map((w) => -w.down))),
  };
}
