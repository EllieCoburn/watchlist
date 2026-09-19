import { formatSignedMoney } from "@/lib/finance/money";
import type { TickerStat } from "@/lib/finance/analytics";
import { cn } from "@/lib/utils";

type TickerBreakdownProps = {
  title: string;
  description: string;
  stats: TickerStat[];
  /** "realized" shows P/L bars; "count" shows trade counts. */
  measure: "realized" | "count";
  emptyText: string;
};

/** Ranked list with a thin proportional bar and direct labels. */
export function TickerBreakdown({
  title,
  description,
  stats,
  measure,
  emptyText,
}: TickerBreakdownProps) {
  const max = Math.max(
    1,
    ...stats.map((s) => (measure === "realized" ? Math.abs(s.realized) : s.trades)),
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <p className="label-caps text-muted">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {stats.length === 0 ? (
        <p className="mt-5 text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="mt-5 space-y-3" role="list">
          {stats.map((s) => {
            const value = measure === "realized" ? s.realized : s.trades;
            const width = `${(Math.abs(value) / max) * 100}%`;
            const bar =
              measure === "count" ? "bg-ink" : value >= 0 ? "bg-gain-text" : "bg-loss-text";
            const text =
              measure === "count" ? "text-ink" : value >= 0 ? "text-gain-text" : "text-loss-text";
            return (
              <li
                key={s.ticker}
                className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 font-mono text-sm"
              >
                <span className="font-semibold tracking-[0.04em] text-ink">{s.ticker}</span>
                <span className="h-1.5 rounded-full bg-canvas-deep" aria-hidden="true">
                  <span className={cn("block h-full rounded-full", bar)} style={{ width }} />
                </span>
                <span className={cn("tabular", text)}>
                  {measure === "realized"
                    ? formatSignedMoney(s.realized)
                    : `${s.trades} ${s.trades === 1 ? "trade" : "trades"}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
