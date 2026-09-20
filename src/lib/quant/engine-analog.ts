import { dateKeyOf, dailyToPathBar, intradayByDate, type DataWindow } from "./data-window";
import type { EngineOutput } from "./engine-mc";
import { featuresAsOf, rankAnalogs, type AnalogMatch } from "./features";
import {
  addOutcome,
  emptyCounts,
  evaluatePath,
  toProbabilities,
  type PathBar,
  type TradeLevels,
} from "./path-eval";
import { weightedPercentile } from "./stats";

/**
 * ENGINE B — historical analog model.
 *
 * "When this stock was in circumstances resembling today's, what happened next?"
 * Each past session j is described by point-in-time features (momentum, realized
 * volatility, ATR, volume, gap, prior-day return / range / close location, distance to
 * 20-day high/low and 50-day average, volatility regime, and benchmark context). The K
 * most similar sessions to today are selected and their ACTUAL next-session path is
 * replayed at 5-minute resolution, rescaled so that the analog's prior close plays the
 * role of today's reference price. Entry, target and stop are applied as the same
 * percentages of that reference. Outcomes are similarity-weighted frequencies.
 *
 * Order inside one 5-minute bar cannot be established, so such cases are AMBIGUOUS.
 * With daily bars only, every "both in one session" case is ambiguous.
 */

export type AnalogDetails = {
  candidates: number;
  selected: number;
  effectiveSampleSize: number;
  sufficient: boolean;
  pathResolution: "intraday" | "daily";
  intradayCoverage: number;
  top: { date: string; similarity: number; mfe: number; mae: number; first: string }[];
  mfe: { p25: number; p50: number; p75: number; p90: number };
  mae: { p25: number; p50: number; p75: number; p90: number };
  /** Share of analog favorable excursions smaller than the target distance (a percentile rank). */
  targetRankInMfe: number;
  /** Share of analog adverse excursions smaller (less negative) than the stop distance. */
  stopRankInMae: number;
  benchmark: string | null;
  ms?: number;
};

export const ANALOG_MIN_SUFFICIENT = 30;

export function runAnalog(
  w: DataWindow,
  levels: TradeLevels,
  reference: { price: number; kind: string; fraction: number },
  horizonDays: number,
  startsIntraday: boolean,
  opts: { k?: number } = {},
): EngineOutput & { details: AnalogDetails } {
  const bars = w.bars;
  const n = bars.length;
  const last = n - 1;
  const empty = (reason: string): EngineOutput & { details: AnalogDetails } => ({
    name: "analog",
    label: "Historical analogs",
    probabilities: toProbabilities(emptyCounts()),
    sampleSize: 0,
    available: false,
    reason,
    details: {
      candidates: 0,
      selected: 0,
      effectiveSampleSize: 0,
      sufficient: false,
      pathResolution: "daily",
      intradayCoverage: 0,
      top: [],
      mfe: { p25: 0, p50: 0, p75: 0, p90: 0 },
      mae: { p25: 0, p50: 0, p75: 0, p90: 0 },
      targetRankInMfe: 0,
      stopRankInMae: 0,
      benchmark: w.benchSymbol,
    },
  });

  const started = Date.now();
  const minBars = Math.round((390 / w.intervalMinutes) * 0.8);
  const query = featuresAsOf(bars, last, w.bench);
  if (!query)
    return empty("Fewer than 60 sessions of history: analog features cannot be computed.");

  // Candidate j: features as of session j; outcome = sessions j+1 .. j+h, all inside the window.
  const candidates: { index: number; f: NonNullable<ReturnType<typeof featuresAsOf>> }[] = [];
  for (let j = 60; j + horizonDays <= last; j++) {
    const f = featuresAsOf(bars, j, w.bench);
    if (f) candidates.push({ index: j, f });
  }
  if (candidates.length < 20)
    return empty(`Only ${candidates.length} candidate sessions: not enough to find analogs.`);

  const ranked = rankAnalogs(query, candidates);
  const k = Math.min(
    opts.k ?? 80,
    Math.max(ANALOG_MIN_SUFFICIENT, Math.floor(candidates.length / 4)),
    ranked.length,
  );
  const selected: AnalogMatch[] = ranked.slice(0, k);

  const byDate = intradayByDate(w);
  const rel = {
    entry: levels.entry / reference.price,
    target: levels.target / reference.price,
    stop: levels.stop / reference.price,
  };
  const counts = emptyCounts();
  const mfes: number[] = [],
    maes: number[] = [],
    weights: number[] = [];
  let intradayHits = 0;
  const top: AnalogDetails["top"] = [];

  for (const m of selected) {
    const j = m.index;
    const ref = bars[j].close;
    const lv: TradeLevels = {
      entry: rel.entry * ref,
      target: rel.target * ref,
      stop: rel.stop * ref,
    };
    const path: PathBar[] = [];
    let usedIntraday = true;
    let mfe = -Infinity,
      mae = Infinity;
    for (let d = 1; d <= horizonDays; d++) {
      const b = bars[j + d];
      const s = byDate.get(dateKeyOf(b));
      if (s && s.bars.length >= minBars) {
        let seq = s.bars;
        if (d === 1 && startsIntraday)
          seq = seq.slice(Math.max(0, Math.floor(seq.length * (1 - reference.fraction))));
        for (const ib of seq)
          path.push({ open: ib.open, high: ib.high, low: ib.low, close: ib.close });
      } else {
        usedIntraday = false;
        path.push(dailyToPathBar(b));
      }
      mfe = Math.max(mfe, Math.log(b.high / ref));
      mae = Math.min(mae, Math.log(b.low / ref));
    }
    if (usedIntraday) intradayHits++;
    const startPrice = startsIntraday && path.length ? path[0].open : ref;
    const outcome = evaluatePath(path, startPrice, lv);
    addOutcome(counts, outcome, m.similarity);
    mfes.push(Math.expm1(mfe));
    maes.push(Math.expm1(mae));
    weights.push(m.similarity);
    if (top.length < 10)
      top.push({
        date: dateKeyOf(bars[j + 1]),
        similarity: m.similarity,
        mfe: Math.expm1(mfe),
        mae: Math.expm1(mae),
        first: outcome.filled ? outcome.first : "no-fill",
      });
  }

  const sumW = weights.reduce((a, b) => a + b, 0);
  const sumW2 = weights.reduce((a, b) => a + b * b, 0);
  const ess = sumW2 > 0 ? (sumW * sumW) / sumW2 : 0;
  const coverage = selected.length ? intradayHits / selected.length : 0;
  const q = (xs: number[], p: number) => weightedPercentile(xs, weights, p);
  const rank = (xs: number[], below: (v: number) => boolean) => {
    let acc = 0;
    xs.forEach((v, i) => {
      if (below(v)) acc += weights[i];
    });
    return sumW > 0 ? acc / sumW : 0;
  };
  const targetDist = rel.target - 1;
  const stopDist = rel.stop - 1;

  return {
    name: "analog",
    label: "Historical analogs (similar past sessions, replayed)",
    probabilities: toProbabilities(counts),
    sampleSize: selected.length,
    available: true,
    reason:
      selected.length < ANALOG_MIN_SUFFICIENT
        ? `Only ${selected.length} comparable sessions.`
        : null,
    details: {
      candidates: candidates.length,
      selected: selected.length,
      effectiveSampleSize: ess,
      sufficient: selected.length >= ANALOG_MIN_SUFFICIENT && ess >= 20,
      pathResolution: coverage >= 0.8 ? "intraday" : "daily",
      intradayCoverage: coverage,
      top,
      mfe: { p25: q(mfes, 0.25), p50: q(mfes, 0.5), p75: q(mfes, 0.75), p90: q(mfes, 0.9) },
      mae: { p25: q(maes, 0.75), p50: q(maes, 0.5), p75: q(maes, 0.25), p90: q(maes, 0.1) },
      targetRankInMfe: rank(mfes, (v) => v < targetDist),
      stopRankInMae: rank(maes, (v) => v > stopDist),
      benchmark: w.benchSymbol,
      ms: Date.now() - started,
    },
  };
}
