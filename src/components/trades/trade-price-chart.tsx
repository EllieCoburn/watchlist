import { combineDateTime, type Trade } from "@/lib/finance/trades";
import { getDataLabel, getPricesBetween } from "@/lib/market-data/provider";
import { TradeChart } from "./trade-chart";
import { TradeChartSlot } from "./trade-detail";

const DAY_MS = 86_400_000;

/** The chart window: a little context on either side of the trade; planned trades show the last month. */
export function tradeChartWindow(trade: Trade, now: number): { from: number; to: number } {
  const entry = combineDateTime(trade.entryDate, trade.entryTime)?.getTime() ?? null;
  const exit = combineDateTime(trade.exitDate, trade.exitTime)?.getTime() ?? null;
  const from = entry != null ? entry - 2 * DAY_MS : now - 30 * DAY_MS;
  const to = Math.min(now, exit != null ? exit + 2 * DAY_MS : now);
  return { from, to };
}

async function loadPoints(trade: Trade) {
  const { from, to } = tradeChartWindow(trade, Date.now());
  try {
    return await getPricesBetween(trade.ticker, from, to);
  } catch {
    return [];
  }
}

/** Server component: fetches prices over the trade's window and renders the chart (or the slot). */
export async function TradePriceChart({ trade }: { trade: Trade }) {
  const points = await loadPoints(trade);
  if (points.length < 2) return <TradeChartSlot trade={trade} />;

  return (
    <TradeChart
      ticker={trade.ticker}
      points={points}
      dataLabel={getDataLabel()}
      levels={{
        entry: trade.entryPrice,
        target: trade.targetPrice,
        stop: trade.stopPrice,
        exit: trade.exitPrice,
      }}
    />
  );
}
