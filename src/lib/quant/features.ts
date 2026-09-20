import type { DailyBar } from "@/lib/market-data/types";
import { mean, std } from "./stats";

/**
 * Point-in-time feature vectors for the historical-analog engine. `featuresAsOf(bars, i)`
 * uses only bars[0..i] (inclusive) — the information available after session i closed —
 * so backtests cannot leak the future.
 */

export const FEATURE_NAMES = [
  "mom5",
  "mom10",
  "mom20",
  "rv20",
  "atr14",
  "volRatio",
  "gap1",
  "ret1",
  "range1",
  "closeLoc1",
  "distHigh20",
  "distLow20",
  "distMa50",
  "regime",
  "bmRet1",
  "bmMom5",
  "bmRv20",
  "corr60",
  "beta60",
] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Relative importance in the distance. Volatility and the most recent session matter most. */
export const FEATURE_WEIGHTS: Record<FeatureName, number> = {
  mom5: 1,
  mom10: 0.5,
  mom20: 0.5,
  rv20: 1.5,
  atr14: 1,
  volRatio: 0.75,
  gap1: 1,
  ret1: 1.25,
  range1: 1,
  closeLoc1: 1,
  distHigh20: 0.75,
  distLow20: 0.75,
  distMa50: 0.5,
  regime: 1,
  bmRet1: 0.75,
  bmMom5: 0.75,
  bmRv20: 0.75,
  corr60: 0.5,
  beta60: 0.5,
};

export type FeatureVector = Record<FeatureName, number>;

function logRet(a: number, b: number): number {
  return a > 0 && b > 0 ? Math.log(a / b) : 0;
}

/** Aligns benchmark bars to the stock's dates (by UTC day). Missing days are carried forward. */
export function alignBenchmark(stock: DailyBar[], bench: DailyBar[] | null): (DailyBar | null)[] {
  if (!bench || bench.length === 0) return stock.map(() => null);
  const byDay = new Map(bench.map((b) => [b.t, b] as const));
  let last: DailyBar | null = null;
  return stock.map((s) => {
    const b = byDay.get(s.t);
    if (b) last = b;
    return b ?? last;
  });
}

export function featuresAsOf(
  bars: DailyBar[],
  i: number,
  bench: (DailyBar | null)[],
): FeatureVector | null {
  if (i < 60) return null; // need 60 sessions of context
  const c = (k: number) => bars[k].close;
  const rets: number[] = [];
  for (let k = i - 251; k <= i; k++) if (k >= 1) rets.push(logRet(c(k), c(k - 1)));
  const last20 = rets.slice(-20);
  const rv20 = std(last20);
  // Regime: percentile of rv20 among rolling 20-day vols in the available window.
  const rolling: number[] = [];
  for (let end = 20; end <= rets.length; end++) rolling.push(std(rets.slice(end - 20, end)));
  const regime = rolling.length ? rolling.filter((v) => v < rv20).length / rolling.length : 0.5;

  let trSum = 0;
  for (let k = i - 13; k <= i; k++) {
    const prev = c(k - 1);
    trSum +=
      Math.max(
        bars[k].high - bars[k].low,
        Math.abs(bars[k].high - prev),
        Math.abs(bars[k].low - prev),
      ) / prev;
  }
  const atr14 = trSum / 14;

  const vols = bars.slice(i - 20, i + 1).map((b) => b.volume ?? 0);
  const avgVol = mean(vols.slice(0, 20));
  const volRatio = avgVol > 0 && bars[i].volume ? Math.log((bars[i].volume ?? avgVol) / avgVol) : 0;

  const hi20 = Math.max(...bars.slice(i - 19, i + 1).map((b) => b.high));
  const lo20 = Math.min(...bars.slice(i - 19, i + 1).map((b) => b.low));
  const ma50 = mean(bars.slice(i - 49, i + 1).map((b) => b.close));
  const b = bars[i];
  const range = b.high - b.low;

  // Benchmark features (zeros when no benchmark is available: they then carry no distance).
  const bm = bench[i];
  const bmPrev = bench[i - 1];
  const bm5 = bench[i - 5];
  let bmRet1 = 0,
    bmMom5 = 0,
    bmRv20 = 0,
    corr60 = 0,
    beta60 = 0;
  if (bm && bmPrev && bm5) {
    bmRet1 = logRet(bm.close, bmPrev.close);
    bmMom5 = logRet(bm.close, bm5.close);
    const bmRets: number[] = [];
    const stRets: number[] = [];
    for (let k = i - 59; k <= i; k++) {
      const a = bench[k],
        p = bench[k - 1];
      if (!a || !p) continue;
      bmRets.push(logRet(a.close, p.close));
      stRets.push(logRet(c(k), c(k - 1)));
    }
    bmRv20 = std(bmRets.slice(-20));
    if (bmRets.length >= 30) {
      const mb = mean(bmRets),
        ms = mean(stRets);
      let cov = 0,
        vb = 0,
        vs = 0;
      for (let k = 0; k < bmRets.length; k++) {
        cov += (bmRets[k] - mb) * (stRets[k] - ms);
        vb += (bmRets[k] - mb) ** 2;
        vs += (stRets[k] - ms) ** 2;
      }
      corr60 = vb && vs ? cov / Math.sqrt(vb * vs) : 0;
      beta60 = vb ? cov / vb : 0;
    }
  }

  return {
    mom5: logRet(c(i), c(i - 5)),
    mom10: logRet(c(i), c(i - 10)),
    mom20: logRet(c(i), c(i - 20)),
    rv20,
    atr14,
    volRatio,
    gap1: logRet(b.open, c(i - 1)),
    ret1: logRet(c(i), c(i - 1)),
    range1: range / b.open,
    closeLoc1: range > 0 ? (b.close - b.low) / range : 0.5,
    distHigh20: logRet(b.close, hi20),
    distLow20: logRet(b.close, lo20),
    distMa50: logRet(b.close, ma50),
    regime,
    bmRet1,
    bmMom5,
    bmRv20,
    corr60,
    beta60,
  };
}

export type AnalogMatch = { index: number; distance: number; similarity: number };

/**
 * Ranks candidate sessions by weighted standardized Euclidean distance to the query.
 * Standardization uses the candidates' own spread (point-in-time when candidates are
 * restricted to the past). Similarity = exp(−d² / 2).
 */
export function rankAnalogs(
  query: FeatureVector,
  candidates: { index: number; f: FeatureVector }[],
): AnalogMatch[] {
  if (candidates.length === 0) return [];
  const scale: Record<string, number> = {};
  for (const name of FEATURE_NAMES) {
    const sd = std(candidates.map((c) => c.f[name]));
    scale[name] = sd > 1e-12 ? sd : 1;
  }
  const totalWeight = FEATURE_NAMES.reduce((a, n) => a + FEATURE_WEIGHTS[n], 0);
  return candidates
    .map((c) => {
      let d2 = 0;
      for (const name of FEATURE_NAMES) {
        const z = (c.f[name] - query[name]) / scale[name];
        d2 += (FEATURE_WEIGHTS[name] / totalWeight) * z * z;
      }
      const distance = Math.sqrt(d2);
      return { index: c.index, distance, similarity: Math.exp(-d2 / 2) };
    })
    .sort((a, b) => a.distance - b.distance);
}
