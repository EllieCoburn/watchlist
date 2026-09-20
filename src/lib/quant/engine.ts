import type { DailyBar } from "@/lib/market-data/types";
import { analyseBarriers, type BarrierAnalysis } from "./barrier";
import { resolveHorizon, type HorizonInput, type ResolvedHorizon } from "./calendar";
import { assessConfidence, type ModelConfidence } from "./confidence";
import { empiricalBarrierAnalysis, type EmpiricalResult } from "./empirical";
import { expectedValue, type ExpectedValue } from "./ev";
import { runMonteCarlo, type MonteCarloResult } from "./monte-carlo";
import {
  autocorrelation,
  ewmaVolatility,
  excessKurtosis,
  mean,
  percentile,
  returnSamples,
  semiDeviation,
  skewness,
  std,
  tail,
  volatilityRegime,
  type VolRegime,
} from "./stats";

export const MODEL_VERSION = "fhs-bridge-1.0";
export const DEFAULT_PATHS = 100_000;

export type SimulationInput = {
  ticker: string;
  entry: number;
  target: number;
  stop: number;
  horizon: HorizonInput;
  shares: number | null;
};

export type SimulationStats = {
  observations: number;
  windowUsed: number;
  firstBarDate: string;
  lastBarDate: string;
  meanReturn20: number;
  volatility: { d20: number; d60: number; d252: number; ewma: number; annualizedEwma: number };
  semiDeviation: { up: number; down: number };
  skewness: number;
  excessKurtosis: number;
  autocorrelation1: number;
  averageTrueRange: number;
  averageRange: number;
  rangePercentiles: { p25: number; p50: number; p75: number };
  gap: { window: number; meanAbs: number; std: number; largeGapCount: number; maxAbs: number };
  regime: { regime: VolRegime; percentile: number; current: number };
};

export type SimulationResult = {
  modelVersion: string;
  input: SimulationInput;
  horizon: ResolvedHorizon;
  barriers: BarrierAnalysis;
  stats: SimulationStats;
  monteCarlo: MonteCarloResult;
  empirical: EmpiricalResult | null;
  ev: ExpectedValue;
  confidence: ModelConfidence;
  data: { source: string; bars: number; firstBarDate: string; lastBarDate: string };
  computedAt: string;
  computeMs: number;
};

export type EngineOptions = {
  now?: number;
  paths?: number;
  seed?: string;
  earningsDate?: string | null;
  dataSource: string;
};

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Runs every part of the model on real daily bars. Pure apart from Date.now() when `now` is omitted. */
export function runSimulation(
  input: SimulationInput,
  bars: DailyBar[],
  opts: EngineOptions,
): SimulationResult {
  const started = Date.now();
  const now = opts.now ?? started;
  if (!(input.entry > 0)) throw new Error("Entry price must be above zero.");
  if (!(input.target > input.entry)) throw new Error("Target must be above the entry price.");
  if (!(input.stop < input.entry) || !(input.stop > 0))
    throw new Error("Stop must be below the entry price and above zero.");
  if (bars.length < 25)
    throw new Error(`Not enough history: ${bars.length} sessions (at least 25 needed).`);

  const samples = returnSamples(bars);
  const daily = samples.map((s) => s.daily);
  const windowUsed = Math.min(252, samples.length);
  const recent = tail(samples, windowUsed);

  const vol20 = std(tail(daily, 20));
  const vol60 = std(tail(daily, 60));
  const vol252 = std(tail(daily, 252));
  const ewma = ewmaVolatility(daily);
  const regime = volatilityRegime(daily);
  const windowVol = std(recent.map((s) => s.daily)) || ewma || 1e-4;
  const regimeScale = Math.min(2.5, Math.max(0.4, ewma / windowVol));

  const gapWindow = Math.min(60, samples.length);
  const gaps = tail(samples, gapWindow).map((s) => s.gap);
  const absGaps = gaps.map(Math.abs);
  const ranges = recent.map((s) => s.range);

  const stats: SimulationStats = {
    observations: samples.length,
    windowUsed,
    firstBarDate: isoDay(bars[0].t),
    lastBarDate: isoDay(bars[bars.length - 1].t),
    meanReturn20: mean(tail(daily, 20)),
    volatility: {
      d20: vol20,
      d60: vol60,
      d252: vol252,
      ewma,
      annualizedEwma: ewma * Math.sqrt(252),
    },
    semiDeviation: semiDeviation(tail(daily, 60)),
    skewness: skewness(tail(daily, 252)),
    excessKurtosis: excessKurtosis(tail(daily, 252)),
    autocorrelation1: autocorrelation(tail(daily, 60)),
    averageTrueRange: mean(tail(samples, 20).map((s) => s.trueRange)),
    averageRange: mean(tail(ranges, 20)),
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
    },
    regime,
  };

  const horizon = resolveHorizon(input.horizon, now);
  const seed =
    opts.seed ??
    `${input.ticker}:${input.entry}:${input.target}:${input.stop}:${horizon.sessions.map((s) => s.dateKey).join(",")}:${stats.lastBarDate}`;
  const paths = Math.max(
    1000,
    Math.min(DEFAULT_PATHS, opts.paths ?? (horizon.sessions.length > 10 ? 50_000 : DEFAULT_PATHS)),
  );

  const monteCarlo = runMonteCarlo({
    entry: input.entry,
    target: input.target,
    stop: input.stop,
    sessions: horizon.sessions,
    samples: recent,
    regimeScale,
    paths,
    seed,
  });

  const targetPct = input.target / input.entry - 1;
  const stopPct = input.stop / input.entry - 1;
  const empirical =
    samples.length >= 40
      ? empiricalBarrierAnalysis(
          bars,
          targetPct,
          stopPct,
          horizon.tradingDays,
          horizon.startsIntraday,
          {
            regimeFilter: { currentVol: vol20 || ewma, band: [0.6, 1.6], minSessions: 40 },
          },
        )
      : null;

  const medianUp =
    empirical?.medianUpExcursion ??
    percentile(
      recent.map((s) => Math.expm1(s.upExcursion)),
      0.5,
    );
  const medianDown =
    empirical?.medianDownExcursion ??
    percentile(
      recent.map((s) => Math.expm1(s.downExcursion)),
      0.5,
    );
  const barriers = analyseBarriers(
    input.entry,
    input.target,
    input.stop,
    stats.averageRange,
    ewma,
    medianUp,
    medianDown,
  );

  const ev = expectedValue(
    input.entry,
    input.target,
    input.stop,
    monteCarlo.probabilities.targetFirst,
    monteCarlo.probabilities.stopFirst,
    monteCarlo.probabilities.neither,
    monteCarlo.meanFinalIfNeither,
    input.shares,
  );

  const lastBar = bars[bars.length - 1].t;
  const confidence = assessConfidence({
    observations: samples.length,
    paths,
    regime: regime.regime,
    regimePercentile: regime.percentile,
    excessKurtosis: stats.excessKurtosis,
    targetRangeMultiple: barriers.target.rangeMultiple,
    stopRangeMultiple: barriers.stop.rangeMultiple,
    earningsDate: opts.earningsDate ?? null,
    horizonDates: horizon.sessions.map((s) => s.dateKey),
    maxAbsGapPct: stats.gap.maxAbs,
    recentLargeGaps: stats.gap.largeGapCount,
    dataSource: opts.dataSource,
    lastBarDate: stats.lastBarDate,
    staleDays: Math.floor((now - lastBar) / 86_400_000),
    horizonNote: horizon.note,
  });

  return {
    modelVersion: MODEL_VERSION,
    input,
    horizon,
    barriers,
    stats,
    monteCarlo,
    empirical,
    ev,
    confidence,
    data: {
      source: opts.dataSource,
      bars: bars.length,
      firstBarDate: stats.firstBarDate,
      lastBarDate: stats.lastBarDate,
    },
    computedAt: new Date(now).toISOString(),
    computeMs: Date.now() - started,
  };
}
