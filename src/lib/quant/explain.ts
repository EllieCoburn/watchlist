import { formatMoney, formatSignedPercent } from "@/lib/finance/money";
import type { SimulationResult } from "./engine";

/**
 * Plain-English explanation generated from the numbers with fixed templates. No language
 * model is involved and nothing here can alter a probability.
 */

const pct = (p: number) => `${Math.round(p * 100)}%`;
const x = (m: number) => `${m.toFixed(2)}×`;

export function explainSimulation(r: SimulationResult): {
  summary: string;
  drivers: string[];
  caveat: string;
} {
  const { ticker, entry, target, stop } = r.input;
  const b = r.barriers;
  const p = r.monteCarlo.probabilities;
  const closer = Math.abs(b.target.percent) < Math.abs(b.stop.percent) ? "target" : "stop";
  const ratio =
    closer === "target"
      ? Math.abs(b.stop.percent) / Math.abs(b.target.percent)
      : Math.abs(b.target.percent) / Math.abs(b.stop.percent);

  const summary =
    `${formatMoney(target)} is ${closer === "target" ? "closer" : "farther"} to your ${formatMoney(entry)} entry than ${formatMoney(stop)}: ` +
    `the target needs a ${formatSignedPercent(b.target.percent * 100)} move, the stop a ${formatSignedPercent(b.stop.percent * 100)} move` +
    (ratio > 1.15
      ? `, about ${ratio.toFixed(1)} times ${closer === "target" ? "less" : "more"}.`
      : ".") +
    ` Based on ${ticker}'s recent volatility and ${r.monteCarlo.paths.toLocaleString("en-US")} simulated price paths over ${r.horizon.label}, ` +
    `the target was touched in ${pct(p.targetTouched)} of paths and the stop in ${pct(p.stopTouched)}. ` +
    `The target was reached first in ${pct(p.targetFirst)} of paths, the stop first in ${pct(p.stopFirst)}, and neither level was touched in ${pct(p.neither)}.`;

  const drivers: string[] = [];
  drivers.push(
    `Distance: the target is ${x(b.target.rangeMultiple)} the average daily range (${(b.averageDailyRangePct * 100).toFixed(2)}%), the stop ${x(b.stop.rangeMultiple)}.`,
  );
  drivers.push(
    `Volatility: one typical day moves about ${(b.dailySigmaPct * 100).toFixed(2)}%; the target is ${b.target.sigmaMultiple.toFixed(2)} of those, the stop ${b.stop.sigmaMultiple.toFixed(2)}. Current regime: ${r.stats.regime.regime}.`,
  );
  drivers.push(
    `Intraday reach: in the last ${r.stats.windowUsed} sessions the median move from the open was ${formatSignedPercent(b.medianUpExcursionPct * 100)} up and ${formatSignedPercent(-b.medianDownExcursionPct * 100)} down.`,
  );
  const drift = r.stats.meanReturn20;
  drivers.push(
    `Recent direction: the average daily move over the last 20 sessions was ${formatSignedPercent(drift * 100)}${Math.abs(drift) < 0.001 ? " (essentially flat)" : ""}; it enters the model through recency-weighted sampling, not as a forecast.`,
  );
  drivers.push(
    `Gaps: the open differed from the prior close by more than 2% in ${r.stats.gap.largeGapCount} of the last ${r.stats.gap.window} sessions${r.horizon.startsIntraday ? "; today's simulation starts from the current price so no opening gap applies" : "; each simulated session starts with a gap drawn from this history"}.`,
  );
  if (r.empirical) {
    const e = r.empirical;
    drivers.push(
      `History check: across ${e.sessions} comparable ${e.horizonDays === 1 ? "sessions" : `${e.horizonDays}-day windows`}, a move of the target's size happened ${pct(e.rates.target)} of the time and a move of the stop's size ${pct(e.rates.stop)}; the target came first in ${pct(e.rates.targetFirst)}, the stop first in ${pct(e.rates.stopFirst)}.`,
    );
  }

  const caveat =
    "Based on historical behaviour and the assumptions of this model. These are frequencies across simulated paths, not a prediction of what will happen; a favourable percentage does not make any single trade profitable.";

  return { summary, drivers, caveat };
}
