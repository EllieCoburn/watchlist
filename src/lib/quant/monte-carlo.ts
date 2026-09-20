import { createRng, createWeightedSampler, hashSeed, type Rng } from "./rng";
import type { SessionSpec } from "./calendar";
import { mean, recencyWeights, weightedStd, type ReturnSample } from "./stats";

/**
 * Monte Carlo first-passage simulation.
 *
 * Model (filtered historical simulation):
 *  - Each simulated session draws one real historical session (gap + intraday return as a
 *    pair, so their relationship and fat tails are preserved), with exponential recency
 *    weighting, then scales both by the current volatility regime ratio.
 *  - Inside the session the price follows a Brownian bridge from the open to the drawn
 *    close, with bridge volatility calibrated so the simulated average daily range matches
 *    the stock's real average range. Barrier crossings are checked at every step and, between
 *    steps, with the exact Brownian-bridge crossing probability, so touches are not missed.
 *  - Returns are never assumed normal: the day-level moves are the stock's own history.
 */

export type MonteCarloInput = {
  entry: number;
  target: number;
  stop: number;
  sessions: SessionSpec[];
  samples: ReturnSample[];
  /** Ratio of current volatility to the sample window's volatility (regime scaling). */
  regimeScale: number;
  paths: number;
  stepsPerDay?: number;
  halfLife?: number;
  seed: string;
};

export type MonteCarloResult = {
  paths: number;
  stepsPerDay: number;
  seed: string;
  counts: {
    targetTouched: number;
    stopTouched: number;
    both: number;
    neither: number;
    targetFirst: number;
    stopFirst: number;
  };
  probabilities: {
    targetTouched: number;
    stopTouched: number;
    both: number;
    neither: number;
    targetFirst: number;
    stopFirst: number;
  };
  /** Per session index: how many paths first touched target / stop during that session. */
  firstTouchBySession: { target: number[]; stop: number[] };
  /** Final price percentiles across all paths (5, 25, 50, 75, 95). */
  finalPricePercentiles: Record<"p5" | "p25" | "p50" | "p75" | "p95", number>;
  /** Mean final price for paths that touched neither barrier. */
  meanFinalIfNeither: number | null;
  calibration: {
    bridgeVolPerDay: number;
    calibratedRange: number;
    targetRange: number;
    regimeScale: number;
    sampleSize: number;
    halfLife: number;
  };
};

const DEFAULT_STEPS = 26; // 15-minute steps across a 390-minute session

/** Probability a Brownian bridge between two log-prices crossed `level` (log) in between. */
function bridgeCrossProbability(a: number, b: number, level: number, variance: number): number {
  if (variance <= 0) return 0;
  const d1 = level - a;
  const d2 = level - b;
  if (d1 * d2 <= 0) return 1; // endpoints straddle the level
  return Math.exp((-2 * d1 * d2) / variance);
}

/** Simulates one session; returns the touch outcome and the final log price. */
function simulateSession(
  rng: Rng,
  logStart: number,
  spec: SessionSpec,
  gap: number,
  intraday: number,
  bridgeVol: number,
  steps: number,
  logTarget: number,
  logStop: number,
): { touched: "target" | "stop" | "none"; logEnd: number; touchedOther: boolean } {
  let touched: "target" | "stop" | "none" = "none";
  let touchedOther = false;
  let x = logStart;

  if (spec.hasGap) {
    x = logStart + gap;
    if (x >= logTarget) touched = "target";
    else if (x <= logStop) touched = "stop";
  }

  const n = Math.max(2, Math.round(steps * spec.fraction));
  const total = intraday;
  const stepVar = (bridgeVol * bridgeVol * spec.fraction) / n;
  const stepSd = Math.sqrt(stepVar);
  const startOfDay = x;

  // Brownian bridge: cumulative noise minus its linear trend, plus the drawn intraday drift.
  const noise = new Float64Array(n + 1);
  let cum = 0;
  for (let i = 1; i <= n; i++) {
    cum += stepSd * rng.gaussian();
    noise[i] = cum;
  }
  const noiseEnd = noise[n];
  let prev = startOfDay;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const cur = startOfDay + f * total + (noise[i] - f * noiseEnd);

    if (touched === "none") {
      const hitT =
        cur >= logTarget || rng.uniform() < bridgeCrossProbability(prev, cur, logTarget, stepVar);
      const hitS =
        cur <= logStop || rng.uniform() < bridgeCrossProbability(prev, cur, logStop, stepVar);
      if (hitT && hitS) {
        // Both within one step: the nearer barrier to the step's start is reached first.
        touched = Math.abs(logTarget - prev) <= Math.abs(logStop - prev) ? "target" : "stop";
        touchedOther = true;
      } else if (hitT) touched = "target";
      else if (hitS) touched = "stop";
    } else if (!touchedOther) {
      const other = touched === "target" ? logStop : logTarget;
      const hit =
        touched === "target"
          ? cur <= other || rng.uniform() < bridgeCrossProbability(prev, cur, other, stepVar)
          : cur >= other || rng.uniform() < bridgeCrossProbability(prev, cur, other, stepVar);
      if (hit) touchedOther = true;
    }
    prev = cur;
  }
  return { touched, logEnd: prev, touchedOther };
}

/** Finds the bridge volatility whose simulated mean daily range matches the historical mean. */
export function calibrateBridgeVolatility(
  samples: ReturnSample[],
  weights: Float64Array,
  regimeScale: number,
  seed: string,
): { bridgeVol: number; calibratedRange: number; targetRange: number } {
  const targetRange = mean(samples.map((s) => s.range)) * regimeScale;
  const intradaySd =
    weightedStd(
      samples.map((s) => s.intraday),
      weights,
    ) * regimeScale;
  const trials = 1500;
  const steps = DEFAULT_STEPS;
  const sampler = createWeightedSampler(weights);

  const meanRangeFor = (vol: number): number => {
    const rng = createRng(hashSeed(`${seed}:calib`));
    let sum = 0;
    for (let t = 0; t < trials; t++) {
      const k = sampler(rng);
      const total = samples[k].intraday * regimeScale;
      let cum = 0;
      const noise = new Float64Array(steps + 1);
      const sd = vol / Math.sqrt(steps);
      for (let i = 1; i <= steps; i++) {
        cum += sd * rng.gaussian();
        noise[i] = cum;
      }
      let hi = 0,
        lo = 0;
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        const x = f * total + (noise[i] - f * noise[steps]);
        if (x > hi) hi = x;
        if (x < lo) lo = x;
      }
      sum += Math.exp(hi) - Math.exp(lo);
    }
    return sum / trials;
  };

  let lo = 0;
  let hi = Math.max(intradaySd * 4, 0.02);
  let best = hi;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const r = meanRangeFor(mid);
    if (r < targetRange) lo = mid;
    else hi = mid;
    best = mid;
  }
  return { bridgeVol: best, calibratedRange: meanRangeFor(best), targetRange };
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const { entry, target, stop, sessions, samples } = input;
  if (samples.length < 5) throw new Error("Not enough historical sessions to simulate.");
  if (!(target > entry && stop < entry))
    throw new Error("Target must be above entry and stop below entry.");
  const stepsPerDay = input.stepsPerDay ?? DEFAULT_STEPS;
  const halfLife = input.halfLife ?? 60;
  const weights = recencyWeights(samples.length, halfLife);
  const sampler = createWeightedSampler(weights);
  const regimeScale = input.regimeScale;
  const calib = calibrateBridgeVolatility(samples, weights, regimeScale, input.seed);

  const rng = createRng(hashSeed(input.seed));
  const logEntry = Math.log(entry);
  const logTarget = Math.log(target);
  const logStop = Math.log(stop);

  const counts = {
    targetTouched: 0,
    stopTouched: 0,
    both: 0,
    neither: 0,
    targetFirst: 0,
    stopFirst: 0,
  };
  const firstT = new Array<number>(sessions.length).fill(0);
  const firstS = new Array<number>(sessions.length).fill(0);
  const finals = new Float64Array(input.paths);
  let neitherSum = 0;
  let neitherN = 0;

  for (let p = 0; p < input.paths; p++) {
    let x = logEntry;
    let first: "target" | "stop" | "none" = "none";
    let other = false;
    for (let d = 0; d < sessions.length; d++) {
      const k = sampler(rng);
      const gap = samples[k].gap * regimeScale;
      const intraday = samples[k].intraday * regimeScale * Math.sqrt(sessions[d].fraction);
      const r = simulateSession(
        rng,
        x,
        sessions[d],
        gap,
        intraday,
        calib.bridgeVol,
        stepsPerDay,
        logTarget,
        logStop,
      );
      x = r.logEnd;
      if (first === "none") {
        if (r.touched !== "none") {
          first = r.touched;
          if (first === "target") firstT[d]++;
          else firstS[d]++;
          if (r.touchedOther) other = true;
        }
      } else if (!other) {
        // Already touched one barrier earlier; keep checking for the other.
        if (r.touched !== "none" && r.touched !== first) other = true;
        else if (r.touchedOther) other = true;
        else if ((first === "target" && x <= logStop) || (first === "stop" && x >= logTarget))
          other = true;
      }
    }
    finals[p] = Math.exp(x);
    if (first === "target") {
      counts.targetTouched++;
      if (other) {
        counts.stopTouched++;
        counts.both++;
      }
      counts.targetFirst++;
    } else if (first === "stop") {
      counts.stopTouched++;
      if (other) {
        counts.targetTouched++;
        counts.both++;
      }
      counts.stopFirst++;
    } else {
      counts.neither++;
      neitherSum += finals[p];
      neitherN++;
    }
  }

  const n = input.paths;
  const sorted = Float64Array.from(finals).sort();
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))];

  return {
    paths: n,
    stepsPerDay,
    seed: input.seed,
    counts,
    probabilities: {
      targetTouched: counts.targetTouched / n,
      stopTouched: counts.stopTouched / n,
      both: counts.both / n,
      neither: counts.neither / n,
      targetFirst: counts.targetFirst / n,
      stopFirst: counts.stopFirst / n,
    },
    firstTouchBySession: { target: firstT, stop: firstS },
    finalPricePercentiles: { p5: q(0.05), p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95) },
    meanFinalIfNeither: neitherN ? neitherSum / neitherN : null,
    calibration: {
      bridgeVolPerDay: calib.bridgeVol,
      calibratedRange: calib.calibratedRange,
      targetRange: calib.targetRange,
      regimeScale,
      sampleSize: samples.length,
      halfLife,
    },
  };
}
