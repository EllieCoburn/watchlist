import {
  calculatePositionValue,
  calculateProfitLoss,
  calculateReturnPercentage,
  calculateRiskReward,
  calculateShares,
  calculateStopLoss,
  calculateTargetProfit,
} from "./calculations";

export type SizingMode = "amount" | "shares";

export type ScenarioInput = {
  ticker: string;
  entryPrice: number;
  sizingMode: SizingMode;
  /** Capital to invest (used when sizingMode === "amount"). */
  amount: number;
  /** Number of shares (used when sizingMode === "shares"). */
  shares: number;
  targetPrice: number | null;
  stopPrice: number | null;
};

export type ScenarioResult = {
  valid: boolean;
  shares: number;
  cost: number;
  target: {
    price: number;
    profit: number;
    returnPercent: number;
    positionValue: number;
  } | null;
  stop: {
    price: number;
    loss: number;
    returnPercent: number;
    positionValue: number;
  } | null;
  riskReward: number | null;
};

/** Every derived number the simulator shows, from raw form input. Pure. */
export function computeScenario(input: ScenarioInput): ScenarioResult {
  const entry = input.entryPrice;
  const shares =
    input.sizingMode === "amount"
      ? calculateShares(input.amount, entry)
      : Math.max(0, input.shares || 0);
  const valid = entry > 0 && shares > 0;
  const cost = valid ? calculatePositionValue(shares, entry) : 0;

  const target =
    valid && input.targetPrice != null && input.targetPrice > 0
      ? {
          price: input.targetPrice,
          profit: calculateTargetProfit(shares, entry, input.targetPrice),
          returnPercent: calculateReturnPercentage(entry, input.targetPrice),
          positionValue: calculatePositionValue(shares, input.targetPrice),
        }
      : null;

  const stop =
    valid && input.stopPrice != null && input.stopPrice > 0
      ? {
          price: input.stopPrice,
          loss: calculateStopLoss(shares, entry, input.stopPrice),
          returnPercent: calculateReturnPercentage(entry, input.stopPrice),
          positionValue: calculatePositionValue(shares, input.stopPrice),
        }
      : null;

  const riskReward =
    valid && input.targetPrice != null && input.stopPrice != null
      ? calculateRiskReward(entry, input.targetPrice, input.stopPrice)
      : null;

  return { valid, shares, cost, target, stop, riskReward };
}

export type Hypothetical = {
  price: number;
  positionValue: number;
  profitLoss: number;
  returnPercent: number;
};

/** "If the stock reaches X": outcome at an arbitrary hypothetical price. Pure. */
export function computeHypothetical(
  shares: number,
  entryPrice: number,
  price: number,
): Hypothetical {
  return {
    price,
    positionValue: calculatePositionValue(shares, price),
    profitLoss: calculateProfitLoss(shares, entryPrice, price),
    returnPercent: calculateReturnPercentage(entryPrice, price),
  };
}

/** Slider bounds: ±12% around entry, widened to include the target and stop. */
export function hypotheticalRange(
  entryPrice: number,
  targetPrice: number | null,
  stopPrice: number | null,
) {
  let min = entryPrice * 0.88;
  let max = entryPrice * 1.12;
  if (stopPrice != null && stopPrice > 0) min = Math.min(min, stopPrice * 0.98);
  if (targetPrice != null && targetPrice > 0) max = Math.max(max, targetPrice * 1.02);
  const step = entryPrice >= 500 ? 0.5 : entryPrice >= 50 ? 0.1 : entryPrice >= 5 ? 0.05 : 0.01;
  return {
    min: Math.max(0.01, Math.floor(min / step) * step),
    max: Math.ceil(max / step) * step,
    step,
  };
}
