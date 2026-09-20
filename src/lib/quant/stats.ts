import type { DailyBar } from "@/lib/market-data/types";

/**
 * Descriptive statistics of a stock's daily behaviour. Everything here is a pure function
 * of real daily bars; nothing is invented.
 */

export type ReturnSample = {
  /** Session date (ms, UTC midnight). */
  t: number;
  /** ln(close / previous close). */
  daily: number;
  /** ln(open / previous close). */
  gap: number;
  /** ln(close / open). */
  intraday: number;
  /** (high − low) / open. */
  range: number;
  /** ln(high / open), ≥ 0. */
  upExcursion: number;
  /** ln(open / low), ≥ 0. */
  downExcursion: number;
  /** True range as a fraction of the previous close. */
  trueRange: number;
};

/** Per-session samples from consecutive bars (first bar has no previous close and is skipped). */
export function returnSamples(bars: DailyBar[]): ReturnSample[] {
  const out: ReturnSample[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1].close;
    if (!(prev > 0 && b.open > 0 && b.close > 0 && b.high > 0 && b.low > 0)) continue;
    out.push({
      t: b.t,
      daily: Math.log(b.close / prev),
      gap: Math.log(b.open / prev),
      intraday: Math.log(b.close / b.open),
      range: (b.high - b.low) / b.open,
      upExcursion: Math.max(0, Math.log(b.high / b.open)),
      downExcursion: Math.max(0, Math.log(b.open / b.low)),
      trueRange: Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev)) / prev,
    });
  }
  return out;
}

export function mean(xs: ArrayLike<number>): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

/** Sample standard deviation. */
export function std(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - m) ** 2;
  return Math.sqrt(s / (n - 1));
}

export function skewness(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const sd = std(xs);
  if (sd === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += ((xs[i] - m) / sd) ** 3;
  return (s * n) / ((n - 1) * (n - 2));
}

/** Excess kurtosis (0 for a normal distribution). */
export function excessKurtosis(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const sd = std(xs);
  if (sd === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += ((xs[i] - m) / sd) ** 4;
  const a = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const b = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return a * s - b;
}

export function percentile(xs: ArrayLike<number>, p: number): number {
  const sorted = Array.from(xs).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Exponentially weighted volatility (RiskMetrics style), most recent observation last. */
export function ewmaVolatility(returns: ArrayLike<number>, lambda = 0.94): number {
  if (returns.length === 0) return 0;
  let v = 0;
  let w = 0;
  let weight = 1;
  for (let i = returns.length - 1; i >= 0; i--) {
    v += weight * returns[i] * returns[i];
    w += weight;
    weight *= lambda;
    if (weight < 1e-6) break;
  }
  return Math.sqrt(v / w);
}

export function tail<T>(xs: T[], n: number): T[] {
  return n >= xs.length ? xs : xs.slice(xs.length - n);
}

/** Downside / upside semi-deviation around zero. */
export function semiDeviation(returns: ArrayLike<number>): { up: number; down: number } {
  let up = 0,
    down = 0,
    nu = 0,
    nd = 0;
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i];
    if (r > 0) {
      up += r * r;
      nu++;
    } else if (r < 0) {
      down += r * r;
      nd++;
    }
  }
  return { up: nu ? Math.sqrt(up / nu) : 0, down: nd ? Math.sqrt(down / nd) : 0 };
}

export function autocorrelation(xs: ArrayLike<number>, lag = 1): number {
  const n = xs.length;
  if (n <= lag + 1) return 0;
  const m = mean(xs);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) den += (xs[i] - m) ** 2;
  for (let i = lag; i < n; i++) num += (xs[i] - m) * (xs[i - lag] - m);
  return den === 0 ? 0 : num / den;
}

export type VolRegime = "low" | "normal" | "elevated" | "extreme";

/** Where today's 20-day volatility sits against the past year's rolling 20-day volatilities. */
export function volatilityRegime(dailyReturns: number[]): {
  regime: VolRegime;
  percentile: number;
  current: number;
} {
  const window = 20;
  if (dailyReturns.length < window + 5)
    return { regime: "normal", percentile: 0.5, current: std(dailyReturns) };
  const rolling: number[] = [];
  for (let end = window; end <= dailyReturns.length; end++)
    rolling.push(std(dailyReturns.slice(end - window, end)));
  const current = rolling[rolling.length - 1];
  const below = rolling.filter((v) => v < current).length;
  const pct = below / rolling.length;
  const regime: VolRegime =
    pct < 0.25 ? "low" : pct < 0.75 ? "normal" : pct < 0.9 ? "elevated" : "extreme";
  return { regime, percentile: pct, current };
}

/** Exponential recency weights (most recent = 1) with the given half-life in observations. */
export function recencyWeights(n: number, halfLife: number): Float64Array {
  const w = new Float64Array(n);
  const k = Math.log(2) / Math.max(1, halfLife);
  for (let i = 0; i < n; i++) w[i] = Math.exp(-k * (n - 1 - i));
  return w;
}

export function weightedMean(xs: ArrayLike<number>, w: ArrayLike<number>): number {
  let s = 0,
    t = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i] * w[i];
    t += w[i];
  }
  return t ? s / t : 0;
}

export function weightedStd(xs: ArrayLike<number>, w: ArrayLike<number>): number {
  const m = weightedMean(xs, w);
  let s = 0,
    t = 0;
  for (let i = 0; i < xs.length; i++) {
    s += w[i] * (xs[i] - m) ** 2;
    t += w[i];
  }
  return t ? Math.sqrt(s / t) : 0;
}

/** Average true range over the last `n` samples, as a fraction of the previous close. */
export function atrPct(samples: ReturnSample[], n = 14): number {
  return mean(tail(samples, n).map((s) => s.trueRange));
}

/**
 * Student-t degrees of freedom implied by excess kurtosis (κ = 6 / (ν − 4)), clamped to
 * [3, 30]. Larger κ → heavier tails → smaller ν.
 */
export function studentTDofFromKurtosis(excessKurt: number): number {
  if (!(excessKurt > 0)) return 30;
  return Math.min(30, Math.max(3, 4 + 6 / excessKurt));
}

/** Standard Student-t draw (Bawens: normal / sqrt(chi²/ν)) scaled to unit variance. */
export function studentT(rng: { gaussian(): number; uniform(): number }, dof: number): number {
  // chi-square with ν degrees of freedom via sum of squared normals is slow for large ν;
  // use the gamma-based shortcut: chi²(ν) = 2·Gamma(ν/2).
  const chi2 = 2 * gammaSample(rng, dof / 2);
  const t = rng.gaussian() / Math.sqrt(chi2 / dof);
  return dof > 2 ? t * Math.sqrt((dof - 2) / dof) : t;
}

/** Marsaglia–Tsang gamma sampler (shape k, scale 1). */
function gammaSample(rng: { gaussian(): number; uniform(): number }, k: number): number {
  if (k < 1) {
    const u = rng.uniform();
    return gammaSample(rng, k + 1) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = rng.gaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.uniform();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Weighted percentile (weights need not sum to 1). */
export function weightedPercentile(values: number[], weights: number[], p: number): number {
  if (values.length === 0) return 0;
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  for (const i of idx) {
    acc += weights[i] / total;
    if (acc >= p) return values[i];
  }
  return values[idx[idx.length - 1]];
}
