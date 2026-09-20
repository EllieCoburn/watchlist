import type { VolRegime } from "./stats";

export type ConfidenceLevel = "high" | "moderate" | "low";

export type ModelConfidence = {
  level: ConfidenceLevel;
  observations: number;
  paths: number;
  volatilityWindows: string;
  regime: VolRegime;
  regimePercentile: number;
  warnings: string[];
  notes: string[];
};

export type ConfidenceInput = {
  observations: number;
  paths: number;
  regime: VolRegime;
  regimePercentile: number;
  excessKurtosis: number;
  targetRangeMultiple: number;
  stopRangeMultiple: number;
  earningsDate: string | null;
  horizonDates: string[];
  maxAbsGapPct: number;
  recentLargeGaps: number;
  dataSource: string;
  lastBarDate: string;
  staleDays: number;
  horizonNote: string | null;
};

export function assessConfidence(c: ConfidenceInput): ModelConfidence {
  const warnings: string[] = [];
  const notes: string[] = [];

  if (c.observations < 60)
    warnings.push(
      `Only ${c.observations} historical sessions were available. Estimates from short histories are unstable.`,
    );
  else if (c.observations < 150)
    notes.push(
      `${c.observations} historical sessions used; a full year (252) would give steadier estimates.`,
    );

  if (c.regime === "extreme")
    warnings.push(
      "Volatility is in the top 10% of the past year. Barrier probabilities move quickly in this regime.",
    );
  else if (c.regime === "elevated")
    notes.push(
      "Volatility is elevated versus the past year; recent sessions are weighted more heavily.",
    );
  else if (c.regime === "low")
    notes.push("Volatility is low versus the past year; the model scales history down to match.");

  if (c.earningsDate) {
    if (c.horizonDates.includes(c.earningsDate))
      warnings.push(
        `Earnings are scheduled on ${c.earningsDate}, inside the simulated period. Earnings moves are far larger than normal sessions and this model does not account for them.`,
      );
    else notes.push(`Next earnings date on record: ${c.earningsDate}.`);
  } else {
    notes.push(
      "Earnings date unknown: check the company's calendar before relying on this estimate.",
    );
  }

  if (c.recentLargeGaps >= 3)
    warnings.push(
      `The stock gapped more than 3% at the open ${c.recentLargeGaps} times in the last 60 sessions. Stops can be jumped by gaps.`,
    );
  if (c.excessKurtosis > 3)
    notes.push(
      "Returns show fat tails (large moves happen more often than a bell curve suggests); the model uses the stock's own history rather than a normal distribution.",
    );

  if (c.targetRangeMultiple < 0.3)
    notes.push(
      "The target sits inside a typical day's range, so it is often reached by ordinary noise.",
    );
  if (c.stopRangeMultiple < 0.3)
    warnings.push(
      "The stop sits inside a typical day's range, so ordinary noise is likely to trigger it.",
    );

  if (c.staleDays > 3)
    warnings.push(
      `The most recent daily bar is from ${c.lastBarDate}, ${c.staleDays} days ago. Recent behaviour is missing from the model.`,
    );
  if (c.horizonNote) notes.push(c.horizonNote);

  let level: ConfidenceLevel = "high";
  if (warnings.length >= 2 || c.observations < 60) level = "low";
  else if (warnings.length === 1 || c.observations < 150) level = "moderate";

  return {
    level,
    observations: c.observations,
    paths: c.paths,
    volatilityWindows: "20 / 60 / 252 days, exponentially weighted (60-day half-life)",
    regime: c.regime,
    regimePercentile: c.regimePercentile,
    warnings,
    notes,
  };
}
