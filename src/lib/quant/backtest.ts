import {
  dateKeyOf,
  dailyToPathBar,
  intradayByDate,
  sliceWindow,
  type DataWindow,
} from "./data-window";
import { runAnalog } from "./engine-analog";
import { runBootstrap } from "./engine-bootstrap";
import { runParametricMc, type EngineOutput } from "./engine-mc";
import type { EngineName } from "./combine";
import { evaluatePath, type PathBar, type Probabilities, type TradeLevels } from "./path-eval";
import type { SessionSpec } from "./calendar";

/**
 * Walk-forward backtest of the same setup (as percentages of the reference price) on
 * past dates. For each date d we stand at the close of d−1, give the engines a window
 * that ends at d−1 (sliceWindow → no future bars, no future intraday sessions, no future
 * benchmark data), predict, then observe what actually happened in sessions d..d+h−1.
 * Predictions are scored for calibration: Brier score, log loss and reliability buckets.
 */

export type CalibrationBucket = {
  lo: number;
  hi: number;
  n: number;
  predicted: number;
  observed: number;
};
export type CalibrationMetrics = {
  n: number;
  positives: number;
  brier: number;
  logLoss: number;
  ece: number;
  buckets: CalibrationBucket[];
};
export type EngineCalibration = { fill: CalibrationMetrics; targetFirst: CalibrationMetrics };

export type BacktestResult = {
  dates: number;
  filledDates: number;
  ambiguousDates: number;
  horizonDays: number;
  firstDate: string;
  lastDate: string;
  pathsPerEngine: number;
  perEngine: Record<EngineName | "combined", EngineCalibration>;
  weights: Partial<Record<EngineName, number>> | null;
  weightMethod: string;
  note: string | null;
};

function metrics(pairs: { p: number; y: number }[]): CalibrationMetrics {
  const n = pairs.length;
  if (n === 0) return { n: 0, positives: 0, brier: NaN, logLoss: NaN, ece: NaN, buckets: [] };
  let brier = 0,
    ll = 0,
    pos = 0;
  const buckets: CalibrationBucket[] = Array.from({ length: 10 }, (_, i) => ({
    lo: i / 10,
    hi: (i + 1) / 10,
    n: 0,
    predicted: 0,
    observed: 0,
  }));
  for (const { p, y } of pairs) {
    const pc = Math.min(1 - 1e-3, Math.max(1e-3, p));
    brier += (p - y) ** 2;
    ll += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
    pos += y;
    const b = buckets[Math.min(9, Math.floor(p * 10))];
    b.n++;
    b.predicted += p;
    b.observed += y;
  }
  let ece = 0;
  for (const b of buckets) {
    if (b.n) {
      b.predicted /= b.n;
      b.observed /= b.n;
      ece += (b.n / n) * Math.abs(b.predicted - b.observed);
    }
  }
  return { n, positives: pos, brier: brier / n, logLoss: ll / n, ece, buckets };
}

type Prediction = Record<EngineName | "combined", Probabilities>;

export function runBacktest(
  w: DataWindow,
  rel: { entry: number; target: number; stop: number },
  horizonDays: number,
  opts: { dates?: number; paths?: number; seed: string },
): BacktestResult {
  const n = w.bars.length;
  const h = Math.max(1, horizonDays);
  const minTrain = 120;
  const maxDates = opts.dates ?? 60;
  const paths = opts.paths ?? 3000;
  const lastStart = n - h; // last d with outcome sessions inside the window
  const firstStart = Math.max(minTrain, lastStart - maxDates + 1);
  const byDate = intradayByDate(w);
  const minBars = Math.round((390 / w.intervalMinutes) * 0.8);
  const names: EngineName[] = ["monte-carlo", "analog", "bootstrap"];

  const fillPairs: Record<string, { p: number; y: number }[]> = {
    "monte-carlo": [],
    analog: [],
    bootstrap: [],
    combined: [],
  };
  const tfPairs: Record<string, { p: number; y: number }[]> = {
    "monte-carlo": [],
    analog: [],
    bootstrap: [],
    combined: [],
  };
  let dates = 0,
    filled = 0,
    ambiguous = 0;

  for (let d = firstStart; d <= lastStart; d++) {
    const train = sliceWindow(w, d - 1);
    if (train.bars.length < minTrain) continue;
    const ref = train.bars[train.bars.length - 1].close;
    const levels: TradeLevels = {
      entry: rel.entry * ref,
      target: rel.target * ref,
      stop: rel.stop * ref,
    };
    const sessions: SessionSpec[] = Array.from({ length: h }, (_, i) => ({
      open: 0,
      close: 0,
      fraction: 1,
      hasGap: true,
      dateKey: dateKeyOf(w.bars[d + i]),
    }));
    const seed = `${opts.seed}:bt:${dateKeyOf(w.bars[d])}`;

    const outputs: EngineOutput[] = [
      runParametricMc(train, levels, { price: ref, gapScale: 1 }, sessions, { paths, seed }),
      runAnalog(train, levels, { price: ref, kind: "last-close", fraction: 1 }, h, false, {
        k: 60,
      }),
      runBootstrap(train, levels, { price: ref, gapScale: 1 }, sessions, { paths, seed }),
    ];
    const pred = {} as Prediction;
    for (const o of outputs) pred[o.name] = o.probabilities;
    const usable = outputs.filter((o) => o.available && o.sampleSize > 0);
    const avg = (key: keyof Probabilities) =>
      usable.reduce((a, o) => a + (o.probabilities[key] as number), 0) / (usable.length || 1);
    pred.combined = {
      ...pred["monte-carlo"],
      fill: avg("fill"),
      targetFirst: avg("targetFirst"),
      stopFirst: avg("stopFirst"),
      neither: avg("neither"),
    };

    // Actual outcome.
    const path: PathBar[] = [];
    for (let i = 0; i < h; i++) {
      const b = w.bars[d + i];
      const s = byDate.get(dateKeyOf(b));
      if (s && s.bars.length >= 60)
        for (const ib of s.bars)
          path.push({ open: ib.open, high: ib.high, low: ib.low, close: ib.close });
      else path.push(dailyToPathBar(b));
    }
    const actual = evaluatePath(path, ref, levels);
    dates++;
    for (const name of [...names, "combined"] as const) {
      const p = pred[name];
      if (name !== "combined" && !outputs.find((o) => o.name === name)?.available) continue;
      fillPairs[name].push({ p: p.fill, y: actual.filled ? 1 : 0 });
    }
    if (actual.filled) {
      filled++;
      if (actual.first === "ambiguous") ambiguous++;
      else {
        for (const name of [...names, "combined"] as const) {
          if (name !== "combined" && !outputs.find((o) => o.name === name)?.available) continue;
          tfPairs[name].push({ p: pred[name].targetFirst, y: actual.first === "target" ? 1 : 0 });
        }
      }
    }
  }

  const perEngine = {} as BacktestResult["perEngine"];
  for (const name of [...names, "combined"] as const)
    perEngine[name] = { fill: metrics(fillPairs[name]), targetFirst: metrics(tfPairs[name]) };

  // Weights from inverse Brier on target-first (the central question), when enough filled dates exist.
  let weights: BacktestResult["weights"] = null;
  let weightMethod = "equal weights: fewer than 30 filled, unambiguous backtest dates";
  const scorable = names.filter(
    (nm) => perEngine[nm].targetFirst.n >= 30 && Number.isFinite(perEngine[nm].targetFirst.brier),
  );
  if (scorable.length === names.length) {
    const inv = names.map((nm) => 1 / (perEngine[nm].targetFirst.brier + 0.005));
    const total = inv.reduce((a, b) => a + b, 0);
    weights = {};
    names.forEach((nm, i) => (weights![nm] = inv[i] / total));
    weightMethod = `inverse Brier score on P(target first | fill) over ${perEngine.combined.targetFirst.n} filled backtest dates`;
  }

  return {
    dates,
    filledDates: filled,
    ambiguousDates: ambiguous,
    horizonDays: h,
    firstDate: dates ? dateKeyOf(w.bars[firstStart]) : "",
    lastDate: dates ? dateKeyOf(w.bars[lastStart]) : "",
    pathsPerEngine: paths,
    perEngine,
    weights,
    weightMethod,
    note:
      dates < 30
        ? `Only ${dates} backtest dates were available; calibration figures are indicative at best.`
        : null,
  };
}
