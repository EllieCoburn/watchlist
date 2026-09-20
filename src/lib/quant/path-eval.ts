/**
 * Evaluates one price path against a trade setup. This is the single definition of
 * "touch", "fill" and "first" used by every engine and by the backtest.
 *
 * A TOUCH means the traded price reached or crossed the level: target touched when a
 * bar's high >= target; stop touched when a bar's low <= stop. Closes are irrelevant.
 *
 * Paths are sequences of bars (open, high, low, close) in time order. A bar may be a
 * real 5-minute bar, a simulated step (with sampled extremes), or a whole daily bar.
 * When both levels fall inside the same bar and their order cannot be established from
 * price continuity, the outcome is marked AMBIGUOUS rather than guessed.
 */

export type PathBar = { open: number; high: number; low: number; close: number };

export type TradeLevels = { entry: number; target: number; stop: number };

export type FirstTouch = "target" | "stop" | "none" | "ambiguous";

export type PathOutcome = {
  filled: boolean;
  /** Index of the bar in which the entry filled, or -1. */
  fillBar: number;
  fillPrice: number | null;
  targetTouched: boolean;
  stopTouched: boolean;
  first: FirstTouch;
  /** Index of the bar in which both levels fell together (order unknown), or -1. */
  ambiguousBar: number;
  /** Price at which the position ends: target, stop, or the last close (end-of-horizon exit). */
  exitPrice: number | null;
  /** Per-share result; null when not filled or when the order of touches is ambiguous. */
  pnlPerShare: number | null;
};

const EPS = 1e-9;

/**
 * Walks the bars in order. `startPrice` is the price at the very start of the path
 * (the reference price before any gap). Entry below the start is a buy limit; above it
 * a buy stop; equal means the position opens immediately.
 */
export function evaluatePath(
  bars: PathBar[],
  startPrice: number,
  levels: TradeLevels,
): PathOutcome {
  const { entry, target, stop } = levels;
  const out: PathOutcome = {
    filled: false,
    fillBar: -1,
    fillPrice: null,
    targetTouched: false,
    stopTouched: false,
    first: "none",
    ambiguousBar: -1,
    exitPrice: null,
    pnlPerShare: null,
  };
  if (bars.length === 0) return out;

  const immediate = Math.abs(entry - startPrice) <= EPS * Math.max(1, startPrice);
  const limitBelow = entry < startPrice;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (!out.filled) {
      let fill: number | null = null;
      if (immediate) fill = startPrice;
      else if (limitBelow) {
        if (b.open <= entry)
          fill = b.open; // gapped through: better fill at the open
        else if (b.low <= entry) fill = entry;
      } else {
        if (b.open >= entry) fill = b.open;
        else if (b.high >= entry) fill = entry;
      }
      if (fill == null) continue;
      out.filled = true;
      out.fillBar = i;
      out.fillPrice = fill;

      // Touches inside the fill bar. Price is continuous, so reaching a level on the far
      // side of the entry implies passing through the entry first: that touch is post-fill.
      // A level on the near side may have been touched before the fill: ambiguous.
      const hitT = b.high >= target;
      const hitS = b.low <= stop;
      if (immediate || fill === b.open) {
        // Position opened at the bar's first print: both touches happen after the fill.
        if (hitT && hitS) {
          out.targetTouched = out.stopTouched = true;
          out.first = "ambiguous";
          out.ambiguousBar = i;
        } else if (hitT) {
          out.targetTouched = true;
          out.first = "target";
        } else if (hitS) {
          out.stopTouched = true;
          out.first = "stop";
        }
      } else if (limitBelow) {
        // Filled at `entry` on the way down. Stop (further down) is certainly after the fill.
        if (hitS) {
          out.stopTouched = true;
        }
        if (hitT) {
          // Target above the entry: could have traded before the dip to the entry.
          out.targetTouched = true;
          out.first = "ambiguous";
          out.ambiguousBar = i;
        } else if (hitS) out.first = "stop";
      } else {
        // Buy stop filled on the way up. Target (further up) is certainly after the fill.
        if (hitT) {
          out.targetTouched = true;
        }
        if (hitS) {
          out.stopTouched = true;
          out.first = "ambiguous";
          out.ambiguousBar = i;
        } else if (hitT) out.first = "target";
      }
      if (out.first !== "none" && out.targetTouched && out.stopTouched) break; // both known
      continue;
    }

    // Post-fill bars.
    const hitT = !out.targetTouched && b.high >= target;
    const hitS = !out.stopTouched && b.low <= stop;
    if (out.first === "none") {
      if (hitT && hitS) {
        out.targetTouched = out.stopTouched = true;
        out.first = "ambiguous";
        out.ambiguousBar = i;
      } else if (hitT) {
        out.targetTouched = true;
        out.first = "target";
      } else if (hitS) {
        out.stopTouched = true;
        out.first = "stop";
      }
    } else {
      if (hitT) out.targetTouched = true;
      if (hitS) out.stopTouched = true;
    }
    if (out.targetTouched && out.stopTouched) break;
  }

  if (out.filled && out.fillPrice != null) {
    if (out.first === "target") out.exitPrice = target;
    else if (out.first === "stop") out.exitPrice = stop;
    else if (out.first === "none") out.exitPrice = bars[bars.length - 1].close;
    if (out.exitPrice != null) out.pnlPerShare = out.exitPrice - out.fillPrice;
  }
  return out;
}

/** Counts across many outcomes. Conditional figures use filled paths only. */
export type OutcomeCounts = {
  paths: number;
  filled: number;
  targetTouched: number;
  stopTouched: number;
  both: number;
  neither: number;
  targetFirst: number;
  stopFirst: number;
  ambiguous: number;
  pnlSum: number;
  pnlCount: number;
  neitherPnlSum: number;
};

export function emptyCounts(): OutcomeCounts {
  return {
    paths: 0,
    filled: 0,
    targetTouched: 0,
    stopTouched: 0,
    both: 0,
    neither: 0,
    targetFirst: 0,
    stopFirst: 0,
    ambiguous: 0,
    pnlSum: 0,
    pnlCount: 0,
    neitherPnlSum: 0,
  };
}

export function addOutcome(c: OutcomeCounts, o: PathOutcome, weight = 1): void {
  c.paths += weight;
  if (!o.filled) return;
  c.filled += weight;
  if (o.targetTouched) c.targetTouched += weight;
  if (o.stopTouched) c.stopTouched += weight;
  if (o.targetTouched && o.stopTouched) c.both += weight;
  if (!o.targetTouched && !o.stopTouched) {
    c.neither += weight;
    if (o.pnlPerShare != null) c.neitherPnlSum += weight * o.pnlPerShare;
  }
  if (o.first === "target") c.targetFirst += weight;
  else if (o.first === "stop") c.stopFirst += weight;
  else if (o.first === "ambiguous") c.ambiguous += weight;
  if (o.pnlPerShare != null) {
    c.pnlSum += weight * o.pnlPerShare;
    c.pnlCount += weight;
  }
}

export type Probabilities = {
  /** P(entry fills within the horizon). */
  fill: number;
  /** All of the following are conditional on the entry filling. */
  targetTouched: number;
  stopTouched: number;
  both: number;
  neither: number;
  targetFirst: number;
  stopFirst: number;
  /** Both touched inside one bar so the order is unknown. */
  ambiguous: number;
  /** Mean per-share P/L over filled paths whose result is known (excludes ambiguous). */
  meanPnlPerShare: number | null;
  /** Mean per-share P/L of "neither" paths at the end-of-horizon exit. */
  meanNeitherPnlPerShare: number | null;
};

export function toProbabilities(c: OutcomeCounts): Probabilities {
  const f = c.filled || 1;
  return {
    fill: c.paths ? c.filled / c.paths : 0,
    targetTouched: c.targetTouched / f,
    stopTouched: c.stopTouched / f,
    both: c.both / f,
    neither: c.neither / f,
    targetFirst: c.targetFirst / f,
    stopFirst: c.stopFirst / f,
    ambiguous: c.ambiguous / f,
    meanPnlPerShare: c.pnlCount ? c.pnlSum / c.pnlCount : null,
    meanNeitherPnlPerShare: c.neither ? c.neitherPnlSum / c.neither : null,
  };
}
