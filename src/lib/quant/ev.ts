/** Expected value of the setup under the model's probabilities. Pure arithmetic. */

export type ExpectedValue = {
  gainPerShare: number;
  lossPerShare: number; // positive magnitude
  rewardToRisk: number;
  /** P(target first) × gain − P(stop first) × loss, ignoring the "neither" paths. */
  evPerShareBarriersOnly: number;
  /** Adds the mean outcome of "neither" paths (marked-to-market at horizon end). */
  evPerShare: number;
  shares: number | null;
  capital: number | null;
  targetProfit: number | null;
  stopLoss: number | null; // negative
  expectedProfit: number | null;
};

export function expectedValue(
  entry: number,
  target: number,
  stop: number,
  pTargetFirst: number,
  pStopFirst: number,
  pNeither: number,
  meanFinalIfNeither: number | null,
  shares: number | null,
): ExpectedValue {
  const gain = target - entry;
  const loss = entry - stop;
  const barriersOnly = pTargetFirst * gain - pStopFirst * loss;
  const neitherPart = meanFinalIfNeither != null ? pNeither * (meanFinalIfNeither - entry) : 0;
  const ev = barriersOnly + neitherPart;
  return {
    gainPerShare: gain,
    lossPerShare: loss,
    rewardToRisk: loss > 0 ? gain / loss : 0,
    evPerShareBarriersOnly: barriersOnly,
    evPerShare: ev,
    shares,
    capital: shares != null ? shares * entry : null,
    targetProfit: shares != null ? shares * gain : null,
    stopLoss: shares != null ? -shares * loss : null,
    expectedProfit: shares != null ? shares * ev : null,
  };
}
