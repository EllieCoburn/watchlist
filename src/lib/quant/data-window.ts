import type { DailyBar, IntradaySession } from "@/lib/market-data/types";
import type { PathBar } from "./path-eval";

/**
 * Everything an engine may look at. Slicing the window to an as-of session is how the
 * backtest guarantees point-in-time correctness: nothing after `bars[bars.length - 1]`
 * exists inside the window.
 */
export type DataWindow = {
  /** Daily bars, oldest first, last = the most recent session known at decision time. */
  bars: DailyBar[];
  /** Regular-hours intraday sessions with dateKey ≤ the last daily bar's date, or null. */
  intraday: IntradaySession[] | null;
  intervalMinutes: number;
  /** Benchmark (e.g. QQQ) daily bars aligned index-for-index with `bars`, null entries when unknown. */
  bench: (DailyBar | null)[];
  benchSymbol: string | null;
};

export function dateKeyOf(bar: DailyBar): string {
  return new Date(bar.t).toISOString().slice(0, 10);
}

/** Restricts a window to sessions up to and including daily index `i`. */
export function sliceWindow(w: DataWindow, i: number): DataWindow {
  const bars = w.bars.slice(0, i + 1);
  const cutoff = dateKeyOf(bars[bars.length - 1]);
  return {
    bars,
    intraday: w.intraday ? w.intraday.filter((s) => s.dateKey <= cutoff) : null,
    intervalMinutes: w.intervalMinutes,
    bench: w.bench.slice(0, i + 1),
    benchSymbol: w.benchSymbol,
  };
}

/** Intraday session lookup by date. */
export function intradayByDate(w: DataWindow): Map<string, IntradaySession> {
  return new Map((w.intraday ?? []).map((s) => [s.dateKey, s]));
}

/** Converts a daily bar to a single path bar (order inside the bar is unknowable). */
export function dailyToPathBar(b: DailyBar): PathBar {
  return { open: b.open, high: b.high, low: b.low, close: b.close };
}

export const BARS_PER_SESSION = 78; // 5-minute bars in a 390-minute session
