/**
 * Pure financial calculations. No rounding here except where a value is inherently
 * discrete; callers round for display via money.ts. Percentages are returned as
 * percentages (12.5), not ratios (0.125).
 */

/** Shares purchasable with `capital` at `price`. Fractional shares allowed. */
export function calculateShares(capital: number, price: number): number {
  if (!(capital > 0) || !(price > 0)) return 0;
  return capital / price;
}

export function calculatePositionValue(shares: number, price: number): number {
  if (!(shares > 0) || !(price >= 0)) return 0;
  return shares * price;
}

/** Signed profit (+) or loss (−) for moving from entry to exit. */
export function calculateProfitLoss(shares: number, entryPrice: number, exitPrice: number): number {
  if (!(shares > 0) || !Number.isFinite(entryPrice) || !Number.isFinite(exitPrice)) return 0;
  return shares * (exitPrice - entryPrice);
}

/** Percentage return from entry to exit, e.g. 1.1428 for 175 → 177. */
export function calculateReturnPercentage(entryPrice: number, exitPrice: number): number {
  if (!(entryPrice > 0) || !Number.isFinite(exitPrice)) return 0;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

/** Potential profit if the target is reached (positive when target > entry). */
export function calculateTargetProfit(
  shares: number,
  entryPrice: number,
  targetPrice: number,
): number {
  return calculateProfitLoss(shares, entryPrice, targetPrice);
}

/** Potential loss if the stop is hit (negative when stop < entry). */
export function calculateStopLoss(shares: number, entryPrice: number, stopPrice: number): number {
  return calculateProfitLoss(shares, entryPrice, stopPrice);
}

/**
 * Reward-to-risk ratio: (target − entry) / (entry − stop).
 * Returns null when the plan is not well-formed (target not above entry, or stop not below it).
 */
export function calculateRiskReward(
  entryPrice: number,
  targetPrice: number,
  stopPrice: number,
): number | null {
  if (!(entryPrice > 0)) return null;
  const reward = targetPrice - entryPrice;
  const risk = entryPrice - stopPrice;
  if (!(reward > 0) || !(risk > 0)) return null;
  return reward / risk;
}

/**
 * Expected value per trade: winRate × averageWin − (1 − winRate) × averageLoss.
 * `winRate` is a ratio 0–1; `averageLoss` is a positive magnitude.
 */
export function calculateExpectancy(
  winRate: number,
  averageWin: number,
  averageLoss: number,
): number {
  if (!Number.isFinite(winRate) || winRate < 0 || winRate > 1) return 0;
  const win = Number.isFinite(averageWin) ? Math.max(averageWin, 0) : 0;
  const loss = Number.isFinite(averageLoss) ? Math.abs(averageLoss) : 0;
  return winRate * win - (1 - winRate) * loss;
}

export type HoldingDuration = {
  milliseconds: number;
  days: number;
  /** Plain-language label, e.g. "3 days", "5 hours", "2 weeks". */
  label: string;
};

/** Holding time between two instants. Never negative. */
export function calculateHoldingDuration(entry: Date, exit: Date): HoldingDuration {
  const ms = Math.max(0, exit.getTime() - entry.getTime());
  const minutes = ms / 60_000;
  const hours = minutes / 60;
  const days = hours / 24;

  let label: string;
  if (minutes < 1) label = "under a minute";
  else if (hours < 1) label = plural(Math.round(minutes), "minute");
  else if (days < 1) label = plural(Math.round(hours), "hour");
  else if (days < 14) label = plural(Math.round(days), "day");
  else if (days < 60) label = plural(Math.round(days / 7), "week");
  else if (days < 365) label = plural(Math.round(days / 30.4), "month");
  else label = plural(Math.round((days / 365.25) * 10) / 10, "year");

  return { milliseconds: ms, days, label };
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
