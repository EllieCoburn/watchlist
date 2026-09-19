import { Disclaimer } from "@/components/ui/disclaimer";
import {
  bestTickers,
  mostTradedTickers,
  performanceOverTime,
  summarizeTrades,
  tickerStats,
  worstTickers,
} from "@/lib/finance/analytics";
import { formatPercent, formatSignedMoney, formatSignedPercent } from "@/lib/finance/money";
import type { Trade } from "@/lib/finance/trades";
import { AnalyticsMetric } from "./analytics-metric";
import { OutcomeBreakdown } from "./outcome-breakdown";
import { PerformanceChart } from "./performance-chart";
import { TickerBreakdown } from "./ticker-breakdown";

function signTone(v: number | null): "ink" | "gain" | "loss" | "faint" {
  if (v == null) return "faint";
  if (v > 0) return "gain";
  if (v < 0) return "loss";
  return "ink";
}

const money = (v: number | null) => (v == null ? "—" : formatSignedMoney(v));

export function AnalyticsDashboard({ trades }: { trades: Trade[] }) {
  const s = summarizeTrades(trades);
  const points = performanceOverTime(trades);
  const stats = tickerStats(trades);

  return (
    <div className="space-y-10">
      <section aria-label="Headline metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetric
          label="Total realized"
          description="Money actually made or lost on closed trades, added together."
          value={money(s.totalRealized)}
          tone={signTone(s.closedCount ? s.totalRealized : null)}
        />
        <AnalyticsMetric
          label="Closed trades"
          description="Trades with both an entry and an exit."
          value={s.closedCount}
        />
        <AnalyticsMetric
          label="Win rate"
          description="Share of closed trades that ended with a gain."
          value={s.winRate == null ? "—" : formatPercent(s.winRate * 100, 0)}
        />
        <AnalyticsMetric
          label="Expectancy"
          description="What you might expect to make, on average, per trade, based on your history so far."
          value={money(s.expectancy)}
          tone={signTone(s.expectancy)}
        />
      </section>

      <PerformanceChart points={points} />

      <section
        aria-label="Averages and extremes"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <AnalyticsMetric
          label="Average winner"
          description="Typical gain on a winning trade."
          value={money(s.averageWinner)}
          tone={signTone(s.averageWinner)}
        />
        <AnalyticsMetric
          label="Average loser"
          description="Typical loss on a losing trade."
          value={money(s.averageLoser)}
          tone={signTone(s.averageLoser)}
        />
        <AnalyticsMetric
          label="Largest winner"
          description="Your single best closed trade."
          value={money(s.largestWinner)}
          tone={signTone(s.largestWinner)}
        />
        <AnalyticsMetric
          label="Largest loser"
          description="Your single worst closed trade."
          value={money(s.largestLoser)}
          tone={signTone(s.largestLoser)}
        />
        <AnalyticsMetric
          label="Average trade return"
          description="Average percentage move from entry to exit across closed trades."
          value={s.averageReturnPercent == null ? "—" : formatSignedPercent(s.averageReturnPercent)}
          tone={signTone(s.averageReturnPercent)}
        />
        <AnalyticsMetric
          label="Average risk / reward"
          description="How much your plans aimed to make for every $1 risked, on trades that had a target and stop."
          value={s.averageRiskReward == null ? "—" : `${s.averageRiskReward.toFixed(1)} : 1`}
        />
        <div className="sm:col-span-2">
          <OutcomeBreakdown wins={s.wins} losses={s.losses} breakeven={s.breakeven} />
        </div>
      </section>

      <section aria-label="Tickers" className="grid gap-4 lg:grid-cols-3">
        <TickerBreakdown
          title="Best performing"
          description="Most realized gain per ticker."
          stats={bestTickers(stats)}
          measure="realized"
          emptyText="No winning tickers yet."
        />
        <TickerBreakdown
          title="Worst performing"
          description="Most realized loss per ticker."
          stats={worstTickers(stats)}
          measure="realized"
          emptyText="No losing tickers yet."
        />
        <TickerBreakdown
          title="Most traded"
          description="Tickers you return to most often."
          stats={mostTradedTickers(stats)}
          measure="count"
          emptyText="No trades yet."
        />
      </section>

      <p className="text-xs text-muted">Figures exclude fees, taxes and dividends.</p>
      <Disclaimer />
    </div>
  );
}
