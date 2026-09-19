import type { ReactNode } from "react";
import { formatPrice, formatSignedNumber, formatSignedPercent } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import { PriceRangeIndicator } from "./price-range-indicator";
import { SparklineChart } from "./sparkline-chart";

export type StockCardData = {
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  low: number;
  high: number;
  sparkline: number[];
};

type StockCardProps = {
  data: StockCardData;
  /** Slot for the remove control (client-side in the real dashboard). */
  remove?: ReactNode;
  /** Range label for the low/high caption, e.g. "1d". */
  rangeLabel?: string;
  className?: string;
};

export function directionOf(change: number): "up" | "down" | "flat" {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

/** Presentational stock card matching the reference. Server-safe; interactivity comes via slots. */
export function StockCard({ data, remove, rangeLabel, className }: StockCardProps) {
  const direction = directionOf(data.change);
  const changeColor =
    direction === "up" ? "text-gain-text" : direction === "down" ? "text-loss-text" : "text-muted";
  const directionWord = direction === "up" ? "up" : direction === "down" ? "down" : "unchanged";

  return (
    <article
      className={cn(
        "rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-7",
        className,
      )}
      aria-label={`${data.ticker}, ${data.companyName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-mono text-base font-semibold tracking-[0.04em] text-ink">
            {data.ticker}
          </h3>
          <p className="mt-1 truncate text-[0.9375rem] text-muted">{data.companyName}</p>
        </div>
        {remove}
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tabular font-mono text-[2.25rem] leading-none text-ink">
          {formatPrice(data.price)}
        </p>
        <p className={cn("tabular font-mono text-sm", changeColor)}>
          <span className="sr-only">
            {directionWord} over {rangeLabel ?? "today"}{" "}
          </span>
          {formatSignedNumber(data.change)}{" "}
          <span className="ml-1">{formatSignedPercent(data.changePercent)}</span>
        </p>
      </div>

      <div className="mt-6">
        <SparklineChart values={data.sparkline} direction={direction} />
      </div>

      <div className="mt-5">
        <PriceRangeIndicator
          low={data.low}
          high={data.high}
          current={data.price}
          direction={direction}
          rangeLabel={rangeLabel}
        />
      </div>
    </article>
  );
}
