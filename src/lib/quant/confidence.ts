import type { BacktestResult } from "./backtest";
import type { EventFlag } from "./events";
import type { VolRegime } from "./stats";

export type ConfidenceLevel = "high" | "moderate" | "low";

export type ModelConfidence = {
  level: ConfidenceLevel;
  /** Plain reasons, best first, shown under the level. */
  reasons: string[];
  warnings: string[];
};

export type ConfidenceInput = {
  analogSelected: number;
  analogEss: number;
  analogSufficient: boolean;
  disagreement: number;
  backtest: BacktestResult | null;
  regime: VolRegime;
  intradayAvailable: boolean;
  intradayCoverage: number;
  observations: number;
  events: EventFlag[];
  lastSessionZ: number;
  lastGap: number;
  largeGaps: number;
  staleDays: number;
  referenceKind: string;
  horizonNote: string | null;
  sanityFailures: string[];
};

/**
 * Confidence is a score built from measurable things: analog sample size, agreement
 * between engines, backtest calibration, data completeness, regime and event risk.
 * It is never a fixed label.
 */
export function assessConfidence(c: ConfidenceInput): ModelConfidence {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0; // higher is better

  if (c.sanityFailures.length) {
    warnings.push(`Automated checks failed: ${c.sanityFailures[0]}`);
    score -= 5;
  }

  if (c.analogSufficient) {
    reasons.push(
      `${c.analogSelected} comparable sessions (effective sample ${c.analogEss.toFixed(0)})`,
    );
    score += 1;
  } else {
    warnings.push(
      `Only ${c.analogSelected} comparable sessions (effective sample ${c.analogEss.toFixed(0)}); the analog estimate is thin.`,
    );
    score -= 1;
  }

  if (c.disagreement < 0.1) {
    reasons.push("the three models broadly agree on which level comes first");
    score += 1;
  } else if (c.disagreement < 0.2) {
    reasons.push(`models differ by ${Math.round(c.disagreement * 100)} points on target-first`);
  } else {
    warnings.push(
      `Models disagree by ${Math.round(c.disagreement * 100)} points on which level comes first; treat the combined figure as uncertain.`,
    );
    score -= 1;
  }

  const bt = c.backtest?.perEngine.combined.targetFirst;
  if (bt && bt.n >= 30 && Number.isFinite(bt.ece)) {
    if (bt.ece < 0.08) {
      reasons.push(
        `backtest calibration error ${(bt.ece * 100).toFixed(1)} points over ${bt.n} dates`,
      );
      score += 1;
    } else if (bt.ece < 0.15) {
      reasons.push(
        `backtest calibration error ${(bt.ece * 100).toFixed(1)} points over ${bt.n} dates`,
      );
    } else {
      warnings.push(
        `Backtest calibration error is ${(bt.ece * 100).toFixed(1)} points over ${bt.n} dates: probabilities have been miscalibrated for this setup historically.`,
      );
      score -= 1;
    }
  } else warnings.push("Not enough backtest dates to measure calibration for this setup.");

  if (c.intradayAvailable)
    reasons.push(
      `intraday bars available (${Math.round(c.intradayCoverage * 100)}% of analogs replayed at 5-minute resolution)`,
    );
  else {
    warnings.push(
      "No intraday bars: first-touch order inside a session cannot be observed, only modeled.",
    );
    score -= 1;
  }

  if (c.observations < 150) {
    warnings.push(`Only ${c.observations} historical sessions.`);
    score -= 1;
  }
  if (c.regime === "extreme") {
    warnings.push("Volatility is in the top 10% of the past year.");
    score -= 1;
  } else if (c.regime === "elevated")
    reasons.push("current volatility elevated versus the past year");
  for (const e of c.events) {
    warnings.push(e.message);
    score -= e.kind === "earnings" ? 2 : 1;
  }
  if (Math.abs(c.lastSessionZ) > 2.5)
    warnings.push(
      `The last session was a ${c.lastSessionZ.toFixed(1)}-sigma move; the next session follows an unusual day.`,
    );
  if (Math.abs(c.lastGap) > 0.03)
    warnings.push(`The last session opened with a ${(c.lastGap * 100).toFixed(1)}% gap.`);
  if (c.largeGaps >= 3)
    warnings.push(
      `${c.largeGaps} gaps above 2% in the last 60 sessions: stops can be jumped overnight.`,
    );
  if (c.staleDays > 4) {
    warnings.push(`Most recent daily bar is ${c.staleDays} days old.`);
    score -= 1;
  }
  if (c.referenceKind === "premarket" || c.referenceKind === "after-hours")
    reasons.push(
      "using a live extended-hours reference price; the residual gap to the open is modeled at half strength",
    );
  if (c.horizonNote) reasons.push(c.horizonNote);

  const level: ConfidenceLevel =
    score >= 3 && warnings.length === 0 ? "high" : score >= 0 ? "moderate" : "low";
  return { level, reasons, warnings };
}
