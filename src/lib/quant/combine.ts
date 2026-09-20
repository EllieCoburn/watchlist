import type { EngineOutput } from "./engine-mc";
import type { Probabilities } from "./path-eval";

export type EngineName = "monte-carlo" | "analog" | "bootstrap";

export type CombinedEstimate = {
  probabilities: Probabilities;
  weights: Partial<Record<EngineName, number>>;
  method: string;
  /** Largest spread between engines in P(target first | fill), a disagreement measure. */
  disagreement: number;
};

const FIELDS: (keyof Probabilities)[] = [
  "fill",
  "targetTouched",
  "stopTouched",
  "both",
  "neither",
  "targetFirst",
  "stopFirst",
  "ambiguous",
];

/**
 * Weighted average of the available engines. A convex combination preserves every
 * identity the sanity checks enforce. Weights come from the walk-forward backtest when it
 * has enough filled observations (inverse Brier score on P(target first | fill)), else
 * they are equal. Engines that report insufficient samples are down-weighted by half.
 */
export function combineEngines(
  engines: EngineOutput[],
  backtestWeights: Partial<Record<EngineName, number>> | null,
): CombinedEstimate {
  const usable = engines.filter((e) => e.available && e.sampleSize > 0);
  if (usable.length === 0) throw new Error("No engine produced an estimate.");
  const weights: Partial<Record<EngineName, number>> = {};
  let method: string;
  if (backtestWeights && usable.every((e) => backtestWeights[e.name] != null)) {
    for (const e of usable) weights[e.name] = backtestWeights[e.name]!;
    method =
      "inverse Brier score of each engine's P(target first | fill) in the walk-forward backtest";
  } else {
    for (const e of usable) weights[e.name] = 1;
    method = "equal weights (backtest sample too small to justify unequal weights)";
  }
  for (const e of usable) if (e.reason) weights[e.name] = (weights[e.name] ?? 1) * 0.5;
  const total = usable.reduce((a, e) => a + (weights[e.name] ?? 0), 0) || 1;
  for (const e of usable) weights[e.name] = (weights[e.name] ?? 0) / total;

  const probabilities = {} as Probabilities;
  for (const f of FIELDS) {
    let v = 0;
    for (const e of usable) v += (weights[e.name] ?? 0) * (e.probabilities[f] as number);
    (probabilities as unknown as Record<string, number>)[f] = v;
  }
  const meanOf = (key: "meanPnlPerShare" | "meanNeitherPnlPerShare") => {
    let v = 0,
      wsum = 0;
    for (const e of usable) {
      const x = e.probabilities[key];
      if (x != null) {
        v += (weights[e.name] ?? 0) * x;
        wsum += weights[e.name] ?? 0;
      }
    }
    return wsum > 0 ? v / wsum : null;
  };
  probabilities.meanPnlPerShare = meanOf("meanPnlPerShare");
  probabilities.meanNeitherPnlPerShare = meanOf("meanNeitherPnlPerShare");

  const tf = usable.map((e) => e.probabilities.targetFirst);
  return { probabilities, weights, method, disagreement: Math.max(...tf) - Math.min(...tf) };
}
