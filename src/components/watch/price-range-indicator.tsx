import { formatPrice } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

type PriceRangeIndicatorProps = {
  low: number;
  high: number;
  current: number;
  direction: "up" | "down" | "flat";
  /** Caption prefix, e.g. "1d" → "1d high & low" for assistive tech. */
  rangeLabel?: string;
};

/** Thin track with a short tick showing where the current price sits between the day's low and high. */
export function PriceRangeIndicator({
  low,
  high,
  current,
  direction,
  rangeLabel = "Daily",
}: PriceRangeIndicatorProps) {
  const span = high - low;
  const ratio = span > 0 ? (current - low) / span : 0.5;
  const percent = Math.min(100, Math.max(0, ratio * 100));
  const tick = direction === "up" ? "bg-gain" : direction === "down" ? "bg-loss" : "bg-faint";

  return (
    <div className="space-y-2.5">
      <div
        className="relative h-[3px] w-full rounded-full bg-canvas-deep"
        role="img"
        aria-label={`${rangeLabel} range ${formatPrice(low)} to ${formatPrice(high)}, currently ${formatPrice(current)}`}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full",
            tick,
          )}
          style={{ left: `${percent}%` }}
        />
      </div>
      <div className="label-caps flex justify-between text-muted" aria-hidden="true">
        <span>
          Low <span className="tabular">{formatPrice(low)}</span>
        </span>
        <span>
          High <span className="tabular">{formatPrice(high)}</span>
        </span>
      </div>
    </div>
  );
}
