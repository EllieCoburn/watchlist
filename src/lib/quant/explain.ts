import { formatMoney, formatSignedPercent } from "@/lib/finance/money";
import type { SimulationResult } from "./engine";

/** Template-based explanation from the computed statistics. No language model; cannot alter a number. */

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function explainSimulation(r: SimulationResult): {
  summary: string;
  drivers: string[];
  models: string;
  caveat: string;
} {
  const { ticker, entry } = r.input;
  const b = r.barriers;
  const cp = r.combined.probabilities;
  const a = r.engines.analog;
  const closer = Math.abs(b.stop.percent) < Math.abs(b.target.percent) ? "stop" : "target";
  const fillNote =
    r.reference.kind === "intraday" || Math.abs(r.levelsRelative.entry - 1) < 1e-6
      ? `The position opens at the reference price of ${formatMoney(r.reference.price)}.`
      : `${ticker} is at ${formatMoney(r.reference.price)}; the entry at ${formatMoney(entry)} fills in ${pct(cp.fill)} of modeled paths over ${r.horizon.label}.`;

  const summary =
    `Your ${closer} is closer to the entry than your ${closer === "stop" ? "target" : "stop"} (${formatSignedPercent(b.stop.percent * 100)} versus ${formatSignedPercent(b.target.percent * 100)}), which raises its first-touch probability. ` +
    fillNote +
    ` Once filled, the target came first in ${pct(cp.targetFirst)} of cases, the stop first in ${pct(cp.stopFirst)}, neither in ${pct(cp.neither)}` +
    (cp.ambiguous > 0.005 ? `, and ${pct(cp.ambiguous)} could not be ordered` : "") +
    ".";

  const drivers: string[] = [];
  drivers.push(
    `Distance: target ${b.target.rangeMultiple.toFixed(2)}× the 20-day average range and ${b.target.sigmaMultiple.toFixed(2)}σ; stop ${b.stop.rangeMultiple.toFixed(2)}× and ${b.stop.sigmaMultiple.toFixed(2)}σ (ATR multiples ${b.target.atrMultiple.toFixed(2)} and ${b.stop.atrMultiple.toFixed(2)}).`,
  );
  if (a.available) {
    drivers.push(
      `History: in ${a.details.selected} comparable sessions, the median favorable excursion from the prior close was ${formatSignedPercent(a.details.mfe.p50 * 100)} (75th percentile ${formatSignedPercent(a.details.mfe.p75 * 100)}) and the median adverse excursion ${formatSignedPercent(a.details.mae.p50 * 100)} (75th ${formatSignedPercent(a.details.mae.p75 * 100)}); the target sits at the ${Math.round((b.target.historicalPercentile ?? 0) * 100)}th percentile of favorable excursions, the stop at the ${Math.round((b.stop.historicalPercentile ?? 0) * 100)}th of adverse ones.`,
    );
  }
  drivers.push(
    `Volatility: EWMA daily volatility ${(r.stats.volatility.ewma * 100).toFixed(2)}% (20/60/252-day close-to-close ${(r.stats.volatility.closeToClose20 * 100).toFixed(2)}% / ${(r.stats.volatility.closeToClose60 * 100).toFixed(2)}% / ${(r.stats.volatility.closeToClose252 * 100).toFixed(2)}%), regime ${r.stats.regime.regime}; ATR(14) ${(r.stats.atr14 * 100).toFixed(2)}%.`,
  );
  drivers.push(
    `Recent session: ${formatSignedPercent(r.stats.lastSession.ret * 100)} (${r.stats.lastSession.zScore.toFixed(1)}σ), range ${(r.stats.lastSession.range * 100).toFixed(2)}%, close at ${Math.round(r.stats.lastSession.closeLocation * 100)}% of its range; opening gap ${formatSignedPercent(r.stats.gap.lastGap * 100)}.`,
  );
  if (r.stats.benchmark) {
    const bm = r.stats.benchmark;
    drivers.push(
      `Market: ${bm.symbol} ${formatSignedPercent(bm.ret1 * 100)} last session, ${formatSignedPercent(bm.mom5 * 100)} over 5 sessions; 60-day correlation ${bm.corr60.toFixed(2)}, beta ${bm.beta60.toFixed(2)}. Analogs are matched on these too.`,
    );
  }
  drivers.push(
    `Gaps: ${r.stats.gap.largeGapCount} opens more than 2% from the prior close in the last ${r.stats.gap.window} sessions; ${r.horizon.startsIntraday ? "no overnight gap applies to today's remaining session" : "each simulated session starts with a modeled gap"}.`,
  );

  const mc = r.engines.monteCarlo.probabilities,
    bs = r.engines.bootstrap.probabilities;
  const models =
    `Across ${r.engines.monteCarlo.sampleSize.toLocaleString("en-US")} parametric Monte Carlo paths (target first ${pct(mc.targetFirst)}), ` +
    (a.available
      ? `${a.details.selected} historical analogs (${pct(a.probabilities.targetFirst)}), `
      : "no usable analogs, ") +
    `and ${r.engines.bootstrap.sampleSize.toLocaleString("en-US")} bootstrap paths (${pct(bs.targetFirst)}), ` +
    (r.combined.disagreement < 0.1
      ? "the models broadly agree"
      : r.combined.disagreement < 0.2
        ? "the models differ moderately"
        : "the models disagree materially") +
    `, giving ${r.confidence.level} confidence in the combined estimate.`;

  const caveat =
    "Based on historical behaviour and the assumptions of these models. Percentages are frequencies across modeled outcomes, not predictions of what will happen. A favourable probability or a positive expected value does not make any single trade profitable.";

  return { summary, drivers, models, caveat };
}
