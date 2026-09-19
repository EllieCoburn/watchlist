import {
  calculateHoldingDuration,
  calculateProfitLoss,
  calculateReturnPercentage,
  type HoldingDuration,
} from "./calculations";
import type { TradeStatus } from "@/lib/supabase/types";

/** A trade with numeric fields already parsed. Produced by lib/data/trades.ts. */
export type Trade = {
  id: string;
  ticker: string;
  companyName: string | null;
  status: TradeStatus;
  entryPrice: number | null;
  entryDate: string | null; // YYYY-MM-DD
  entryTime: string | null; // HH:MM or HH:MM:SS
  shares: number | null;
  capital: number | null;
  targetPrice: number | null;
  stopPrice: number | null;
  exitPrice: number | null;
  exitDate: string | null;
  exitTime: string | null;
  notes: string | null;
  entryReason: string | null;
  reflection: string | null;
  followedPlan: boolean | null;
  improvement: string | null;
  scenarioId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TradeOutcome = "win" | "loss" | "breakeven";

/** Combines a date and optional time into a Date (local time). Null when the date is missing. */
export function combineDateTime(date: string | null, time: string | null): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh = 0, mm = 0, ss = 0] = (time ?? "").split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Capital at risk: the user-entered capital, else shares × entry. */
export function tradeCapital(t: Trade): number | null {
  if (t.capital != null && t.capital > 0) return t.capital;
  if (t.shares != null && t.entryPrice != null) return t.shares * t.entryPrice;
  return null;
}

/** Realized profit/loss. Only closed trades with entry, exit and shares have one. */
export function tradeRealizedPnl(t: Trade): number | null {
  if (t.status !== "closed" || t.entryPrice == null || t.exitPrice == null || t.shares == null)
    return null;
  return calculateProfitLoss(t.shares, t.entryPrice, t.exitPrice);
}

export function tradeReturnPercent(t: Trade): number | null {
  if (t.status !== "closed" || t.entryPrice == null || t.exitPrice == null) return null;
  return calculateReturnPercentage(t.entryPrice, t.exitPrice);
}

export function tradeOutcome(t: Trade): TradeOutcome | null {
  const pnl = tradeRealizedPnl(t);
  if (pnl == null) return null;
  const cents = Math.round(pnl * 100);
  if (cents > 0) return "win";
  if (cents < 0) return "loss";
  return "breakeven";
}

/** Dollars the plan risks if the stop is hit (positive magnitude). */
export function tradePlannedRisk(t: Trade): number | null {
  if (t.entryPrice == null || t.stopPrice == null || t.shares == null) return null;
  if (t.stopPrice >= t.entryPrice) return null;
  return t.shares * (t.entryPrice - t.stopPrice);
}

/** Dollars the plan aims for if the target is reached. */
export function tradePlannedReward(t: Trade): number | null {
  if (t.entryPrice == null || t.targetPrice == null || t.shares == null) return null;
  if (t.targetPrice <= t.entryPrice) return null;
  return t.shares * (t.targetPrice - t.entryPrice);
}

export function tradeRiskReward(t: Trade): number | null {
  const risk = tradePlannedRisk(t);
  const reward = tradePlannedReward(t);
  if (risk == null || reward == null || risk <= 0) return null;
  return reward / risk;
}

export function tradeHolding(t: Trade): HoldingDuration | null {
  const entry = combineDateTime(t.entryDate, t.entryTime);
  const exit = combineDateTime(t.exitDate, t.exitTime);
  if (!entry || !exit || t.status !== "closed") return null;
  return calculateHoldingDuration(entry, exit);
}

/** The date a list should sort and display by: exit for closed trades, else entry, else created. */
export function tradePrimaryDate(t: Trade): string {
  if (t.status === "closed" && t.exitDate) return t.exitDate;
  if (t.entryDate) return t.entryDate;
  return t.createdAt.slice(0, 10);
}

export type TradeSort = "newest" | "oldest" | "largest-win" | "largest-loss";
export type TradeFilter = "all" | "open" | "closed" | "planned";

export function filterTrades(trades: Trade[], filter: TradeFilter, search: string): Trade[] {
  const q = search.trim().toUpperCase();
  return trades.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (q && !t.ticker.includes(q)) return false;
    return true;
  });
}

export function sortTrades(trades: Trade[], sort: TradeSort): Trade[] {
  const copy = [...trades];
  const byDateDesc = (a: Trade, b: Trade) =>
    tradePrimaryDate(b).localeCompare(tradePrimaryDate(a)) ||
    b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "newest":
      return copy.sort(byDateDesc);
    case "oldest":
      return copy.sort((a, b) => -byDateDesc(a, b));
    case "largest-win":
      return copy.sort(
        (a, b) =>
          (tradeRealizedPnl(b) ?? -Infinity) - (tradeRealizedPnl(a) ?? -Infinity) ||
          byDateDesc(a, b),
      );
    case "largest-loss":
      return copy.sort(
        (a, b) =>
          (tradeRealizedPnl(a) ?? Infinity) - (tradeRealizedPnl(b) ?? Infinity) || byDateDesc(a, b),
      );
  }
}
