import type { SessionSpec } from "./calendar";
import { BARS_PER_SESSION, type DataWindow } from "./data-window";
import {
  addOutcome,
  emptyCounts,
  evaluatePath,
  toProbabilities,
  type PathBar,
  type Probabilities,
  type TradeLevels,
} from "./path-eval";
import { createRng, hashSeed, type Rng } from "./rng";
import {
  ewmaVolatility,
  excessKurtosis,
  returnSamples,
  std,
  studentT,
  studentTDofFromKurtosis,
  tail,
} from "./stats";

/**
 * ENGINE A — parametric Monte Carlo first-passage model.
 *
 * Log price follows  d ln S = σ dW  with μ = 0 (drift is negligible over one or a few
 * sessions and its estimate from short windows is dominated by noise). Innovations are
 * Student-t with ν implied by the stock's excess kurtosis, standardized to unit variance,
 * so the model has fat tails without pretending to know the distribution's shape better
 * than the data does.
 *
 * Volatility is split into an overnight part and an intraday part using the historical
 * variance share of gaps, and the intraday part is spread across the session with the
 * stock's own realized 5-minute volatility profile (U-shaped in practice). Across
 * multi-day horizons σ² follows an EWMA recursion (λ = 0.94) on the simulated returns,
 * a standard volatility-clustering approximation.
 *
 * Each 5-minute step becomes a bar whose high and low are sampled from the exact
 * Brownian-bridge extreme distributions, so touches inside a step are neither missed
 * nor invented. Bars are then judged by the shared path evaluator.
 */

export type ParametricMcParams = {
  sigmaDaily: number;
  sigmaGap: number;
  sigmaIntraday: number;
  gapVarianceShare: number;
  dof: number;
  excessKurtosis: number;
  profile: number[]; // per-slot variance shares, sum 1
  profileSource: "intraday" | "flat";
  lambda: number;
  paths: number;
  seed: string;
};

export type EngineOutput = {
  name: "monte-carlo" | "analog" | "bootstrap";
  label: string;
  probabilities: Probabilities;
  sampleSize: number;
  available: boolean;
  reason: string | null;
  details: Record<string, unknown>;
};

/** Per-slot share of intraday variance from real 5-minute bars (last 60 sessions), or flat. */
export function intradayVarianceProfile(
  w: DataWindow,
  slots = BARS_PER_SESSION,
): { profile: number[]; source: "intraday" | "flat" } {
  const sessions = w.intraday ? tail(w.intraday, 60) : [];
  if (sessions.length < 20) return { profile: new Array(slots).fill(1 / slots), source: "flat" };
  const sums = new Array(slots).fill(0);
  const counts = new Array(slots).fill(0);
  for (const s of sessions) {
    const n = s.bars.length;
    for (let k = 0; k < n; k++) {
      const prev = k === 0 ? s.bars[0].open : s.bars[k - 1].close;
      const r = Math.log(s.bars[k].close / prev);
      const slot = Math.min(slots - 1, Math.floor((k * slots) / n));
      sums[slot] += r * r;
      counts[slot]++;
    }
  }
  const raw = sums.map((v, k) => (counts[k] ? v / counts[k] : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { profile: new Array(slots).fill(1 / slots), source: "flat" };
  // Shrink 30% toward flat so a few extreme sessions cannot dominate a slot.
  const profile = raw.map((v) => 0.7 * (v / total) + 0.3 / slots);
  return { profile, source: "intraday" };
}

export function estimateParametric(w: DataWindow, paths: number, seed: string): ParametricMcParams {
  const samples = returnSamples(w.bars);
  const daily = samples.map((s) => s.daily);
  const sigmaDaily = ewmaVolatility(daily, 0.94);
  const recent = tail(samples, 60);
  const gapVar = std(recent.map((s) => s.gap)) ** 2;
  const intraVar = std(recent.map((s) => s.intraday)) ** 2;
  const share =
    gapVar + intraVar > 0 ? Math.min(0.7, Math.max(0.05, gapVar / (gapVar + intraVar))) : 0.2;
  const kurt = excessKurtosis(tail(daily, 252));
  const { profile, source } = intradayVarianceProfile(w);
  return {
    sigmaDaily,
    sigmaGap: sigmaDaily * Math.sqrt(share),
    sigmaIntraday: sigmaDaily * Math.sqrt(1 - share),
    gapVarianceShare: share,
    dof: studentTDofFromKurtosis(kurt),
    excessKurtosis: kurt,
    profile,
    profileSource: source,
    lambda: 0.94,
    paths,
    seed,
  };
}

/** Samples a bar's high and low given start/end log prices and the step variance (bridge extremes). */
export function bridgeBar(rng: Rng, a: number, b: number, variance: number): PathBar {
  const d = b - a;
  const u1 = Math.max(rng.uniform(), 1e-12);
  const u2 = Math.max(rng.uniform(), 1e-12);
  const hi = (a + b + Math.sqrt(d * d - 2 * variance * Math.log(u1))) / 2;
  const lo = (a + b - Math.sqrt(d * d - 2 * variance * Math.log(u2))) / 2;
  return {
    open: Math.exp(a),
    close: Math.exp(b),
    high: Math.exp(Math.max(hi, a, b)),
    low: Math.exp(Math.min(lo, a, b)),
  };
}

/**
 * Replaces one step with `n` sub-steps drawn from the Brownian bridge conditioned on the
 * step's endpoints (the exact conditional law of the model), each with its own sampled
 * extremes. Used only when both levels fell inside one step, to resolve their order at a
 * finer resolution instead of declaring the step ambiguous.
 */
export function refineStep(
  rng: Rng,
  a: number,
  b: number,
  variance: number,
  n: number,
): { bars: PathBar[]; logs: number[]; vars: number[] } {
  const bars: PathBar[] = [];
  const logs: number[] = [];
  const vars: number[] = [];
  const noise = new Float64Array(n + 1);
  const sd = Math.sqrt(variance / n);
  let cum = 0;
  for (let i = 1; i <= n; i++) {
    cum += sd * rng.gaussian();
    noise[i] = cum;
  }
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const x = i === n ? b : a + f * (b - a) + (noise[i] - f * noise[n]);
    bars.push(bridgeBar(rng, prev, x, variance / n));
    logs.push(prev);
    vars.push(variance / n);
    prev = x;
  }
  return { bars, logs, vars };
}

export const REFINE_SUBSTEPS = 10;
export const REFINE_ROUNDS = 2;

export function runParametricMc(
  w: DataWindow,
  levels: TradeLevels,
  reference: { price: number; gapScale: number },
  sessions: SessionSpec[],
  opts: { paths: number; seed: string },
): EngineOutput {
  const started = Date.now();
  const p = estimateParametric(w, opts.paths, opts.seed);
  const rng = createRng(hashSeed(`${opts.seed}:mc`));
  const counts = emptyCounts();
  const slots = p.profile.length;
  let refined = 0;
  let stillAmbiguous = 0;

  for (let n = 0; n < opts.paths; n++) {
    let sigma2 = p.sigmaDaily * p.sigmaDaily;
    let x = Math.log(reference.price);
    let bars: PathBar[] = [];
    let logs: number[] = [];
    let vars: number[] = [];
    for (const s of sessions) {
      const sigma = Math.sqrt(sigma2);
      const sGap = sigma * Math.sqrt(p.gapVarianceShare) * (s.hasGap ? reference.gapScale : 0);
      const sIntra = sigma * Math.sqrt(1 - p.gapVarianceShare);
      const dayStart = x;
      if (s.hasGap && sGap > 0) x += sGap * studentT(rng, p.dof);
      const nSteps = Math.max(2, Math.round(slots * s.fraction));
      const firstSlot = slots - nSteps;
      // Renormalize the profile over the slots actually simulated.
      let share = 0;
      for (let k = firstSlot; k < slots; k++) share += p.profile[k];
      for (let k = firstSlot; k < slots; k++) {
        const v = sIntra * sIntra * (p.profile[k] / share) * s.fraction;
        const next = x + Math.sqrt(v) * studentT(rng, p.dof);
        bars.push(bridgeBar(rng, x, next, v));
        logs.push(x);
        vars.push(v);
        x = next;
      }
      const dayRet = x - dayStart;
      sigma2 = p.lambda * sigma2 + (1 - p.lambda) * dayRet * dayRet;
    }
    let outcome = evaluatePath(bars, reference.price, levels);
    for (
      let round = 0;
      round < REFINE_ROUNDS && outcome.first === "ambiguous" && outcome.ambiguousBar >= 0;
      round++
    ) {
      const i = outcome.ambiguousBar;
      const fine = refineStep(rng, logs[i], Math.log(bars[i].close), vars[i], REFINE_SUBSTEPS);
      bars = [...bars.slice(0, i), ...fine.bars, ...bars.slice(i + 1)];
      logs = [...logs.slice(0, i), ...fine.logs, ...logs.slice(i + 1)];
      vars = [...vars.slice(0, i), ...fine.vars, ...vars.slice(i + 1)];
      refined++;
      outcome = evaluatePath(bars, reference.price, levels);
    }
    if (outcome.first === "ambiguous") stillAmbiguous++;
    addOutcome(counts, outcome);
  }

  return {
    name: "monte-carlo",
    label: "Parametric Monte Carlo (Student-t, EWMA volatility)",
    probabilities: toProbabilities(counts),
    sampleSize: opts.paths,
    available: true,
    reason: null,
    details: {
      sigmaDaily: p.sigmaDaily,
      sigmaGap: p.sigmaGap,
      sigmaIntraday: p.sigmaIntraday,
      gapVarianceShare: p.gapVarianceShare,
      studentTDof: p.dof,
      excessKurtosis: p.excessKurtosis,
      intradayProfile: p.profileSource,
      stepsPerSession: slots,
      drift: 0,
      lambda: p.lambda,
      refinement: `${REFINE_SUBSTEPS} sub-steps × up to ${REFINE_ROUNDS} rounds on ambiguous steps`,
      refinedSteps: refined,
      stillAmbiguousPaths: stillAmbiguous,
      seed: opts.seed,
      ms: Date.now() - started,
    },
  };
}
