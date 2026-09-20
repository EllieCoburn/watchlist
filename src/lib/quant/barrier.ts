/** Distance-to-barrier statistics: how far each level is, and how that compares with normal movement. */

export type BarrierDistance = {
  dollars: number;
  percent: number;
  /** Distance as a multiple of the average daily range ((high − low) / open). */
  rangeMultiple: number;
  /** Distance as a multiple of one daily standard deviation of returns. */
  sigmaMultiple: number;
  /** Distance as a multiple of the median one-day excursion in that direction from the open. */
  excursionMultiple: number;
};

export type BarrierAnalysis = {
  target: BarrierDistance;
  stop: BarrierDistance;
  averageDailyRangePct: number;
  dailySigmaPct: number;
  medianUpExcursionPct: number;
  medianDownExcursionPct: number;
};

export function analyseBarriers(
  entry: number,
  target: number,
  stop: number,
  averageDailyRange: number,
  dailySigma: number,
  medianUpExcursion: number,
  medianDownExcursion: number,
): BarrierAnalysis {
  const dist = (level: number, excursion: number): BarrierDistance => {
    const dollars = level - entry;
    const percent = dollars / entry;
    const abs = Math.abs(percent);
    return {
      dollars,
      percent,
      rangeMultiple: averageDailyRange > 0 ? abs / averageDailyRange : 0,
      sigmaMultiple: dailySigma > 0 ? abs / dailySigma : 0,
      excursionMultiple: excursion > 0 ? abs / excursion : 0,
    };
  };
  return {
    target: dist(target, medianUpExcursion),
    stop: dist(stop, medianDownExcursion),
    averageDailyRangePct: averageDailyRange,
    dailySigmaPct: dailySigma,
    medianUpExcursionPct: medianUpExcursion,
    medianDownExcursionPct: medianDownExcursion,
  };
}
