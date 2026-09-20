import { runBacktest, type BacktestResult } from "./backtest";
import { resolveHorizon, type HorizonInput, type ResolvedHorizon } from "./calendar";
import { sanityCheck } from "./checks";
import { combineEngines, type CombinedEstimate, type EngineName } from "./combine";
import { assessConfidence, type ModelConfidence } from "./confidence";
import type { DataWindow } from "./data-window";
import { runAnalog, type AnalogDetails } from "./engine-analog";
import { runBootstrap } from "./engine-bootstrap";
import { runParametricMc, type EngineOutput } from "./engine-mc";
import { eventsInHorizon, type EventFlag } from "./events";
import type { Probabilities, TradeLevels } from "./path-eval";
import type { ReferencePrice } from "./reference";
import {
  atrPct,
  autocorrelation,
  ewmaVolatility,
  excessKurtosis,
  mean,
  percentile,
  returnSamples,
  skewness,
  std,
  tail,
  volatilityRegime,
  type VolRegime,
} from "./stats";

export const MODEL_VERSION = "first-passage-3-engine-2.0";
export const DEFAULT_PATHS = 100_000;

export type SimulationInput = {
  ticker: string;
  entry: number;
  target: number;
  stop: number;
  horizon: HorizonInput;
  shares: number | null;
};

export type BarrierDistance = {
  dollars: number;
  percent: number;
  atrMultiple: number;
  rangeMultiple: number;
  sigmaMultiple: number;
  /** Percentile rank within the analog MFE (target) or MAE (stop) distribution, 0–1. */
  historicalPercentile: number | null;
};

export type SimulationStats = {
  observations: number;
  firstBarDate: string;
  lastBarDate: string;
  lastClose: number;
  volatility: {
    closeToClose20: number;
    closeToClose60: number;
    closeToClose252: number;
    ewma: number;
    annualizedEwma: number;
    realizedIntraday20: number | null;
  };
  atr14: number;
  averageRange20: number;
  rangePercentiles: { p25: number; p50: number; p75: number };
  gap: {
    window: number;
    meanAbs: number;
    std: number;
    largeGapCount: number;
    maxAbs: number;
    lastGap: number;
  };
  lastSession: { ret: number; range: number; closeLocation: number; zScore: number };
  skewness: number;
  excessKurtosis: number;
  autocorrelation1: number;
  regime: { regime: VolRegime; percentile: number; current: number };
  benchmark: {
    symbol: string;
    ret1: number;
    mom5: number;
    rv20: number;
    corr60: number;
    beta60: number;
  } | null;
  intraday: { sessions: number; intervalMinutes: number } | null;
};

export type ExpectedValue = {
  fillPriceAssumed: number;
  gainPerShare: number;
  lossPerShare: number;
  rewardToRisk: number;
  /** Conditional on a fill: P(target first)·gain − P(stop first)·loss + P(neither)·E[exit − fill] + ambiguous split. */
  evPerShareIfFilled: number;
  /** Unconditional: P(fill) × EV | fill (no fill → 0). */
  evPerShare: number;
  neitherHandling: string;
  ambiguousHandling: string;
  shares: number | null;
  capital: number | null;
  targetProfit: number | null;
  stopLoss: number | null;
  expectedValueIfFilled: number | null;
  expectedValue: number | null;
};

export type SimulationResult = {
  modelVersion: string;
  input: SimulationInput;
  reference: ReferencePrice;
  horizon: ResolvedHorizon;
  levelsRelative: { entry: number; target: number; stop: number };
  barriers: { target: BarrierDistance; stop: BarrierDistance };
  stats: SimulationStats;
  engines: {
    monteCarlo: EngineOutput;
    analog: EngineOutput & { details: AnalogDetails };
    bootstrap: EngineOutput;
  };
  combined: CombinedEstimate;
  backtest: BacktestResult | null;
  ev: ExpectedValue;
  events: EventFlag[];
  confidence: ModelConfidence;
  checks: { passed: boolean; failures: string[] };
  provenance: Record<string, string | number | null>;
  computedAt: string;
  computeMs: number;
};

export type EngineOptions = {
  now?: number;
  paths?: number;
  seed?: string;
  earningsDate?: string | null;
  dataSource: string;
  provider: string;
  quoteAsOf: number | null;
  reference: ReferencePrice;
  backtest?: boolean;
  backtestDates?: number;
  backtestPaths?: number;
};

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

function ambiguousSplit(p: Probabilities): { target: number; stop: number } {
  const decided = p.targetFirst + p.stopFirst;
  if (p.ambiguous <= 0) return { target: 0, stop: 0 };
  if (decided <= 0) return { target: p.ambiguous / 2, stop: p.ambiguous / 2 };
  return {
    target: (p.ambiguous * p.targetFirst) / decided,
    stop: (p.ambiguous * p.stopFirst) / decided,
  };
}

export function computeStats(w: DataWindow): SimulationStats {
  const bars = w.bars;
  const samples = returnSamples(bars);
  const daily = samples.map((s) => s.daily);
  const ewma = ewmaVolatility(daily);
  const gapWindow = Math.min(60, samples.length);
  const gaps = tail(samples, gapWindow).map((s) => s.gap);
  const absGaps = gaps.map(Math.abs);
  const ranges = tail(samples, 252).map((s) => s.range);
  const last = samples[samples.length - 1];
  const lastBar = bars[bars.length - 1];
  const sd20 = std(tail(daily, 20));

  let realizedIntraday20: number | null = null;
  if (w.intraday && w.intraday.length >= 20) {
    const vars = tail(w.intraday, 20).map((s) =>
      s.bars.reduce((acc, b, k) => {
        const prev = k === 0 ? b.open : s.bars[k - 1].close;
        const r = Math.log(b.close / prev);
        return acc + r * r;
      }, 0),
    );
    realizedIntraday20 = Math.sqrt(mean(vars));
  }

  let benchmark: SimulationStats["benchmark"] = null;
  const bi = bars.length - 1;
  const bm = w.bench[bi],
    bmPrev = w.bench[bi - 1],
    bm5 = w.bench[bi - 5];
  if (w.benchSymbol && bm && bmPrev && bm5) {
    const bmRets: number[] = [],
      stRets: number[] = [];
    for (let k = bi - 59; k <= bi; k++) {
      const a = w.bench[k],
        p = w.bench[k - 1];
      if (!a || !p || k < 1) continue;
      bmRets.push(Math.log(a.close / p.close));
      stRets.push(Math.log(bars[k].close / bars[k - 1].close));
    }
    let corr = 0,
      beta = 0;
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
      corr = vb && vs ? cov / Math.sqrt(vb * vs) : 0;
      beta = vb ? cov / vb : 0;
    }
    benchmark = {
      symbol: w.benchSymbol,
      ret1: Math.log(bm.close / bmPrev.close),
      mom5: Math.log(bm.close / bm5.close),
      rv20: std(bmRets.slice(-20)),
      corr60: corr,
      beta60: beta,
    };
  }

  return {
    observations: samples.length,
    firstBarDate: isoDay(bars[0].t),
    lastBarDate: isoDay(lastBar.t),
    lastClose: lastBar.close,
    volatility: {
      closeToClose20: sd20,
      closeToClose60: std(tail(daily, 60)),
      closeToClose252: std(tail(daily, 252)),
      ewma,
      annualizedEwma: ewma * Math.sqrt(252),
      realizedIntraday20,
    },
    atr14: atrPct(samples, 14),
    averageRange20: mean(tail(ranges, 20)),
    rangePercentiles: {
      p25: percentile(ranges, 0.25),
      p50: percentile(ranges, 0.5),
      p75: percentile(ranges, 0.75),
    },
    gap: {
      window: gapWindow,
      meanAbs: mean(absGaps),
      std: std(gaps),
      largeGapCount: absGaps.filter((g) => g > 0.02).length,
      maxAbs: Math.max(0, ...absGaps),
      lastGap: last.gap,
    },
    lastSession: {
      ret: last.daily,
      range: last.range,
      closeLocation:
        lastBar.high > lastBar.low
          ? (lastBar.close - lastBar.low) / (lastBar.high - lastBar.low)
          : 0.5,
      zScore: sd20 > 0 ? last.daily / sd20 : 0,
    },
    skewness: skewness(tail(daily, 252)),
    excessKurtosis: excessKurtosis(tail(daily, 252)),
    autocorrelation1: autocorrelation(tail(daily, 60)),
    regime: volatilityRegime(daily),
    benchmark,
    intraday: w.intraday
      ? { sessions: w.intraday.length, intervalMinutes: w.intervalMinutes }
      : null,
  };
}

/** Runs all engines, the backtest, and every derived section. Pure apart from Date.now() when `now` is omitted. */
export function runSimulation(
  input: SimulationInput,
  w: DataWindow,
  opts: EngineOptions,
): SimulationResult {
  const started = Date.now();
  const now = opts.now ?? started;
  if (!(input.entry > 0)) throw new Error("Entry price must be above zero.");
  if (!(input.target > input.entry)) throw new Error("Target must be above the entry price.");
  if (!(input.stop < input.entry) || !(input.stop > 0))
    throw new Error("Stop must be below the entry price and above zero.");
  if (w.bars.length < 60)
    throw new Error(`Not enough history: ${w.bars.length} sessions (at least 60 needed).`);

  const stats = computeStats(w);
  const horizon = resolveHorizon(input.horizon, now);
  const reference = opts.reference;
  const levels: TradeLevels = { entry: input.entry, target: input.target, stop: input.stop };
  const rel = {
    entry: input.entry / reference.price,
    target: input.target / reference.price,
    stop: input.stop / reference.price,
  };
  const seed =
    opts.seed ??
    `${input.ticker}:${reference.price.toFixed(4)}:${input.entry}:${input.target}:${input.stop}:${horizon.sessions.map((s) => s.dateKey).join(",")}:${stats.lastBarDate}`;
  const paths = Math.max(
    1000,
    Math.min(DEFAULT_PATHS, opts.paths ?? (horizon.sessions.length > 10 ? 50_000 : DEFAULT_PATHS)),
  );
  const gapScale = horizon.startsIntraday ? 0 : reference.gapScale;

  const monteCarlo = runParametricMc(
    w,
    levels,
    { price: reference.price, gapScale },
    horizon.sessions,
    { paths, seed },
  );
  const analog = runAnalog(
    w,
    levels,
    { price: reference.price, kind: reference.kind, fraction: horizon.sessions[0]?.fraction ?? 1 },
    horizon.tradingDays,
    horizon.startsIntraday,
    { k: 80 },
  );
  // Bootstrap cost scales with bars per session; 1-minute data uses half the paths (still ≥ 50,000).
  const bootstrapPaths =
    w.intraday && w.intervalMinutes <= 2 ? Math.max(1000, Math.round(paths / 2)) : paths;
  const bootstrap = runBootstrap(
    w,
    levels,
    { price: reference.price, gapScale },
    horizon.sessions,
    { paths: bootstrapPaths, seed },
  );

  let backtest: BacktestResult | null = null;
  if (opts.backtest !== false && w.bars.length >= 150) {
    backtest = runBacktest(w, rel, horizon.tradingDays, {
      dates: opts.backtestDates ?? 50,
      paths: opts.backtestPaths ?? 1500,
      seed,
    });
  }
  const combined = combineEngines([monteCarlo, analog, bootstrap], backtest?.weights ?? null);

  // Barrier distances.
  const dist = (level: number, percentile: number | null): BarrierDistance => {
    const dollars = level - input.entry;
    const percent = dollars / input.entry;
    const abs = Math.abs(percent);
    return {
      dollars,
      percent,
      atrMultiple: stats.atr14 > 0 ? abs / stats.atr14 : 0,
      rangeMultiple: stats.averageRange20 > 0 ? abs / stats.averageRange20 : 0,
      sigmaMultiple: stats.volatility.ewma > 0 ? abs / stats.volatility.ewma : 0,
      historicalPercentile: percentile,
    };
  };
  const barriers = {
    target: dist(input.target, analog.available ? analog.details.targetRankInMfe : null),
    stop: dist(input.stop, analog.available ? analog.details.stopRankInMae : null),
  };

  // Expected value from the combined conditional probabilities.
  const cp = combined.probabilities;
  const gain = input.target - input.entry;
  const loss = input.entry - input.stop;
  const split = ambiguousSplit(cp);
  const neitherPnl = cp.meanNeitherPnlPerShare ?? 0;
  const evIfFilled =
    (cp.targetFirst + split.target) * gain -
    (cp.stopFirst + split.stop) * loss +
    cp.neither * neitherPnl;
  const evUncond = cp.fill * evIfFilled;
  const shares = input.shares;
  const ev: ExpectedValue = {
    fillPriceAssumed: input.entry,
    gainPerShare: gain,
    lossPerShare: loss,
    rewardToRisk: loss > 0 ? gain / loss : 0,
    evPerShareIfFilled: evIfFilled,
    evPerShare: evUncond,
    neitherHandling:
      "Paths that touch neither level exit at the last simulated close of the horizon (market order at end of session); their average per-share result is included.",
    ambiguousHandling:
      "Paths where both levels fell inside one bar are split between target-first and stop-first in the ratio of the decided cases.",
    shares,
    capital: shares != null ? shares * input.entry : null,
    targetProfit: shares != null ? shares * gain : null,
    stopLoss: shares != null ? -shares * loss : null,
    expectedValueIfFilled: shares != null ? shares * evIfFilled : null,
    expectedValue: shares != null ? shares * evUncond : null,
  };

  const events = eventsInHorizon(
    horizon.sessions.map((s) => s.dateKey),
    opts.earningsDate ?? null,
  );

  const failures = [
    ...sanityCheck(monteCarlo.probabilities, "Monte Carlo"),
    ...(analog.available ? sanityCheck(analog.probabilities, "Analog") : []),
    ...sanityCheck(bootstrap.probabilities, "Bootstrap"),
    ...sanityCheck(cp, "Combined"),
  ];

  const lastBarMs = w.bars[w.bars.length - 1].t;
  const confidence = assessConfidence({
    analogSelected: analog.details.selected,
    analogEss: analog.details.effectiveSampleSize,
    analogSufficient: analog.details.sufficient,
    disagreement: combined.disagreement,
    backtest,
    regime: stats.regime.regime,
    intradayAvailable: Boolean(w.intraday && w.intraday.length >= 40),
    intradayCoverage: analog.details.intradayCoverage,
    observations: stats.observations,
    events,
    lastSessionZ: stats.lastSession.zScore,
    lastGap: stats.gap.lastGap,
    largeGaps: stats.gap.largeGapCount,
    staleDays: Math.floor((now - lastBarMs) / 86_400_000) - (horizon.startsIntraday ? 0 : 0),
    referenceKind: reference.kind,
    horizonNote: horizon.note,
    sanityFailures: failures,
  });

  const provenance: SimulationResult["provenance"] = {
    "Market data provider": opts.provider,
    "Daily history source": opts.dataSource,
    "Last price timestamp": opts.quoteAsOf ? new Date(opts.quoteAsOf).toISOString() : null,
    "Reference price": `${reference.price.toFixed(4)} (${reference.kind})`,
    "Historical period": `${stats.firstBarDate} → ${stats.lastBarDate} (${stats.observations} sessions)`,
    "Intraday data": w.intraday
      ? `${w.intraday.length} sessions at ${w.intervalMinutes}-minute bars`
      : "unavailable",
    "Analog sessions": `${analog.details.selected} of ${analog.details.candidates} candidates (effective ${analog.details.effectiveSampleSize.toFixed(1)})`,
    "Simulation paths": `Monte Carlo ${paths.toLocaleString("en-US")}, bootstrap ${bootstrapPaths.toLocaleString("en-US")}`,
    "Volatility methodology": `EWMA (λ=0.94) of close-to-close log returns; gap/intraday split from 60-session variance shares; Student-t ν=${(monteCarlo.details.studentTDof as number).toFixed(1)}`,
    "Bootstrap methodology": String(bootstrap.details.mode ?? ""),
    "Market benchmark": w.benchSymbol ?? "none",
    Backtest: backtest
      ? `${backtest.dates} walk-forward dates (${backtest.firstDate} → ${backtest.lastDate}), ${backtest.pathsPerEngine} paths per engine per date`
      : "not run",
    Combination: combined.method,
    "Model version": MODEL_VERSION,
    Seed: seed,
  };

  return {
    modelVersion: MODEL_VERSION,
    input,
    reference,
    horizon,
    levelsRelative: rel,
    barriers,
    stats,
    engines: { monteCarlo, analog, bootstrap },
    combined,
    backtest,
    ev,
    events,
    confidence,
    checks: { passed: failures.length === 0, failures },
    provenance,
    computedAt: new Date(now).toISOString(),
    computeMs: Date.now() - started,
  };
}

export type { EngineName };
