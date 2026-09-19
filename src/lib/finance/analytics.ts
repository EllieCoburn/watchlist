import { calculateExpectancy } from "./calculations";
import {
  combineDateTime,
  tradeOutcome,
  tradeRealizedPnl,
  tradeReturnPercent,
  tradeRiskReward,
  type Trade,
} from "./trades";

export type AnalyticsSummary = {
  closedCount: number;
  totalRealized: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** 0–1 ratio of wins among closed trades (break-evens count as not wins). */
  winRate: number | null;
  averageWinner: number | null;
  averageLoser: number | null; // negative number
  largestWinner: number | null;
  largestLoser: number | null; // negative number
  averageReturnPercent: number | null;
  averageRiskReward: number | null;
  expectancy: number | null;
};

export type PerformancePoint = {
  /** YYYY-MM-DD of the exit. */
  date: string;
  /** Realized on that day. */
  realized: number;
  /** Running total up to and including that day. */
  cumulative: number;
};

export type TickerStat = {
  ticker: string;
  companyName: string | null;
  trades: number;
  closed: number;
  realized: number;
  wins: number;
  losses: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Every headline metric for the analytics page. Only closed trades count. */
export function summarizeTrades(trades: Trade[]): AnalyticsSummary {
  const closed = trades.filter((t) => tradeRealizedPnl(t) != null);
  const pnls = closed.map((t) => tradeRealizedPnl(t) as number);
  const winners = pnls.filter((p) => Math.round(p * 100) > 0);
  const losers = pnls.filter((p) => Math.round(p * 100) < 0);
  const breakeven = pnls.length - winners.length - losers.length;

  const winRate = pnls.length ? winners.length / pnls.length : null;
  const averageWinner = average(winners);
  const averageLoser = average(losers);
  const returns = closed.map((t) => tradeReturnPercent(t)).filter((r): r is number => r != null);
  const ratios = closed.map((t) => tradeRiskReward(t)).filter((r): r is number => r != null);

  return {
    closedCount: pnls.length,
    totalRealized: pnls.reduce((a, b) => a + b, 0),
    wins: winners.length,
    losses: losers.length,
    breakeven,
    winRate,
    averageWinner,
    averageLoser,
    largestWinner: winners.length ? Math.max(...winners) : null,
    largestLoser: losers.length ? Math.min(...losers) : null,
    averageReturnPercent: average(returns),
    averageRiskReward: average(ratios),
    expectancy:
      winRate == null
        ? null
        : calculateExpectancy(winRate, averageWinner ?? 0, Math.abs(averageLoser ?? 0)),
  };
}

/** Cumulative realized P/L by exit date, oldest first. Trades without an exit date use their update date. */
export function performanceOverTime(trades: Trade[]): PerformancePoint[] {
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const pnl = tradeRealizedPnl(t);
    if (pnl == null) continue;
    const day = t.exitDate ?? t.updatedAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + pnl);
  }
  const days = Array.from(byDay.keys()).sort();
  let running = 0;
  return days.map((date) => {
    const realized = byDay.get(date) ?? 0;
    running += realized;
    return { date, realized, cumulative: running };
  });
}

export function tickerStats(trades: Trade[]): TickerStat[] {
  const map = new Map<string, TickerStat>();
  for (const t of trades) {
    const stat = map.get(t.ticker) ?? {
      ticker: t.ticker,
      companyName: t.companyName,
      trades: 0,
      closed: 0,
      realized: 0,
      wins: 0,
      losses: 0,
    };
    stat.trades += 1;
    if (!stat.companyName && t.companyName) stat.companyName = t.companyName;
    const pnl = tradeRealizedPnl(t);
    if (pnl != null) {
      stat.closed += 1;
      stat.realized += pnl;
      const outcome = tradeOutcome(t);
      if (outcome === "win") stat.wins += 1;
      if (outcome === "loss") stat.losses += 1;
    }
    map.set(t.ticker, stat);
  }
  return Array.from(map.values());
}

export function bestTickers(stats: TickerStat[], limit = 5): TickerStat[] {
  return stats
    .filter((s) => s.closed > 0 && Math.round(s.realized * 100) > 0)
    .sort((a, b) => b.realized - a.realized)
    .slice(0, limit);
}

export function worstTickers(stats: TickerStat[], limit = 5): TickerStat[] {
  return stats
    .filter((s) => s.closed > 0 && Math.round(s.realized * 100) < 0)
    .sort((a, b) => a.realized - b.realized)
    .slice(0, limit);
}

export function mostTradedTickers(stats: TickerStat[], limit = 5): TickerStat[] {
  return [...stats].sort((a, b) => b.trades - a.trades || b.closed - a.closed).slice(0, limit);
}

/** Convenience for the "held for" style copy: first and last exit dates in the set. */
export function closedDateRange(trades: Trade[]): { from: Date; to: Date } | null {
  const dates = trades
    .filter((t) => tradeRealizedPnl(t) != null)
    .map((t) => combineDateTime(t.exitDate, null))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;
  return { from: dates[0], to: dates[dates.length - 1] };
}
