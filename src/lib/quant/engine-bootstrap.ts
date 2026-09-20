import type { SessionSpec } from "./calendar";
import { BARS_PER_SESSION, type DataWindow } from "./data-window";
import { bridgeBar, type EngineOutput } from "./engine-mc";
import {
  addOutcome,
  emptyCounts,
  evaluatePath,
  toProbabilities,
  type PathBar,
  type TradeLevels,
} from "./path-eval";
import { createRng, createWeightedSampler, hashSeed } from "./rng";
import { ewmaVolatility, recencyWeights, returnSamples, std, tail } from "./stats";

/**
 * ENGINE C — historical bootstrap.
 *
 * With intraday data: a block bootstrap of the stock's own 5-minute bars. Each simulated
 * session takes an overnight gap resampled from sessions in a similar volatility regime,
 * then hour-long blocks (12 bars) copied from randomly chosen historical sessions at the
 * SAME time of day, so intraday seasonality and short-range dependence inside the hour
 * survive. Each copied bar carries its real open/high/low/close ratios, so intrabar
 * extremes are real, not sampled. Log moves are scaled by the current-volatility ratio.
 *
 * Without intraday data: a bootstrap of real (gap, open-to-close) daily pairs with a
 * calibrated Brownian bridge inside the session (bar extremes sampled from the bridge).
 */

type BarRatios = { o: number; h: number; l: number; c: number }; // log ratios vs previous bar close

export function runBootstrap(
  w: DataWindow,
  levels: TradeLevels,
  reference: { price: number; gapScale: number },
  sessions: SessionSpec[],
  opts: { paths: number; seed: string; blockBars?: number },
): EngineOutput {
  const started = Date.now();
  const rng = createRng(hashSeed(`${opts.seed}:boot`));
  const samples = returnSamples(w.bars);
  if (samples.length < 25) {
    return {
      name: "bootstrap",
      label: "Historical bootstrap",
      probabilities: toProbabilities(emptyCounts()),
      sampleSize: 0,
      available: false,
      reason: "Not enough daily history.",
      details: {},
    };
  }
  const daily = samples.map((s) => s.daily);
  const ewma = ewmaVolatility(daily, 0.94);
  const intradayOk = (w.intraday?.length ?? 0) >= 40;

  // Gap pool conditioned on the volatility regime (trailing 20-day vol within 0.6–1.6× current).
  const vol20 = std(tail(daily, 20)) || ewma;
  const gapPool: number[] = [];
  for (let i = 20; i < samples.length; i++) {
    const v = std(daily.slice(i - 20, i));
    if (v >= vol20 * 0.6 && v <= vol20 * 1.6) gapPool.push(samples[i].gap);
  }
  const gaps = gapPool.length >= 20 ? gapPool : samples.map((s) => s.gap);
  const gapRegimeConditioned = gapPool.length >= 20;

  const counts = emptyCounts();
  const barsPerSession = intradayOk ? Math.round(390 / w.intervalMinutes) : BARS_PER_SESSION;
  const slots = barsPerSession;

  if (intradayOk) {
    const pool = tail(w.intraday!, 120);
    const poolDates = new Set(pool.map((s) => s.dateKey));
    const poolDaily = samples
      .filter((s) => poolDates.has(new Date(s.t).toISOString().slice(0, 10)))
      .map((s) => s.daily);
    const poolVol = std(poolDaily.length >= 20 ? poolDaily : tail(daily, 120)) || ewma;
    const rho = Math.min(2, Math.max(0.5, ewma / poolVol));
    const weights = recencyWeights(pool.length, 40);
    const pick = createWeightedSampler(weights);
    const ratios: BarRatios[][] = pool.map((s) =>
      s.bars.map((b, k) => {
        const prev = k === 0 ? b.open : s.bars[k - 1].close;
        return {
          o: Math.log(b.open / prev),
          h: Math.log(b.high / prev),
          l: Math.log(b.low / prev),
          c: Math.log(b.close / prev),
        };
      }),
    );
    const block = opts.blockBars ?? Math.max(1, Math.round(60 / w.intervalMinutes)); // one hour of bars

    for (let n = 0; n < opts.paths; n++) {
      let price = reference.price;
      const bars: PathBar[] = [];
      for (const s of sessions) {
        if (s.hasGap) price *= Math.exp(rho * reference.gapScale * gaps[rng.int(gaps.length)]);
        const nSteps = Math.max(2, Math.round(slots * s.fraction));
        const firstSlot = slots - nSteps;
        let k = firstSlot;
        while (k < slots) {
          const src = ratios[pick(rng)];
          const end = Math.min(slots, k + block);
          for (let j = k; j < end; j++) {
            const r = src[Math.min(j, src.length - 1)];
            const o = price * Math.exp(rho * r.o);
            const h = price * Math.exp(rho * r.h);
            const l = price * Math.exp(rho * r.l);
            const c = price * Math.exp(rho * r.c);
            bars.push({ open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
            price = c;
          }
          k = end;
        }
      }
      addOutcome(counts, evaluatePath(bars, reference.price, levels));
    }
    return {
      name: "bootstrap",
      label: "Intraday block bootstrap (real 5-minute bars)",
      probabilities: toProbabilities(counts),
      sampleSize: opts.paths,
      available: true,
      reason: null,
      details: {
        mode: "intraday-block",
        poolSessions: pool.length,
        blockBars: block,
        regimeScale: rho,
        gapPool: gaps.length,
        gapRegimeConditioned,
        seed: opts.seed,
        ms: Date.now() - started,
      },
    };
  }

  // Daily fallback: resample (gap, intraday) pairs; bridge inside the session.
  const recent = tail(samples, 252);
  const weights = recencyWeights(recent.length, 60);
  const pick = createWeightedSampler(weights);
  const windowVol = std(recent.map((s) => s.daily)) || ewma;
  const rho = Math.min(2.5, Math.max(0.4, ewma / windowVol));
  const meanRange = recent.reduce((a, s) => a + s.range, 0) / recent.length;
  // Bridge volatility such that E[high − low] over a session ≈ mean range: bisection on a quick simulation.
  const intradaySd = std(recent.map((s) => s.intraday)) * rho;
  let lo = 0,
    hi = Math.max(intradaySd * 4, 0.02),
    bridgeVol = hi;
  const trialRng = createRng(hashSeed(`${opts.seed}:calib`));
  const meanRangeFor = (vol: number) => {
    let sum = 0;
    const trials = 800;
    for (let t = 0; t < trials; t++) {
      const total = recent[pick(trialRng)].intraday * rho;
      let x = 0,
        top = 0,
        bottom = 0;
      for (let k = 0; k < slots; k++) {
        const next = x + total / slots + (vol / Math.sqrt(slots)) * trialRng.gaussian();
        const bar = bridgeBar(trialRng, x, next, (vol * vol) / slots);
        top = Math.max(top, Math.log(bar.high));
        bottom = Math.min(bottom, Math.log(bar.low));
        x = next;
      }
      sum += Math.exp(top) - Math.exp(bottom);
    }
    return sum / trials;
  };
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (meanRangeFor(mid) < meanRange * rho) lo = mid;
    else hi = mid;
    bridgeVol = mid;
  }

  for (let n = 0; n < opts.paths; n++) {
    let x = Math.log(reference.price);
    const bars: PathBar[] = [];
    for (const s of sessions) {
      const k = pick(rng);
      if (s.hasGap) x += rho * reference.gapScale * recent[k].gap;
      const total = rho * recent[k].intraday * Math.sqrt(s.fraction);
      const nSteps = Math.max(2, Math.round(slots * s.fraction));
      const noise = new Float64Array(nSteps + 1);
      const sd = (bridgeVol * Math.sqrt(s.fraction)) / Math.sqrt(nSteps);
      let cum = 0;
      for (let j = 1; j <= nSteps; j++) {
        cum += sd * rng.gaussian();
        noise[j] = cum;
      }
      const start = x;
      for (let j = 1; j <= nSteps; j++) {
        const f = j / nSteps;
        const next = start + f * total + (noise[j] - f * noise[nSteps]);
        bars.push(bridgeBar(rng, x, next, sd * sd));
        x = next;
      }
    }
    addOutcome(counts, evaluatePath(bars, reference.price, levels));
  }
  return {
    name: "bootstrap",
    label: "Daily bootstrap with intraday bridge (no intraday data available)",
    probabilities: toProbabilities(counts),
    sampleSize: opts.paths,
    available: true,
    reason: "Intraday bars were unavailable; intrabar extremes are modeled, not observed.",
    details: {
      mode: "daily-bridge",
      poolSessions: recent.length,
      regimeScale: rho,
      bridgeVol,
      seed: opts.seed,
    },
  };
}
