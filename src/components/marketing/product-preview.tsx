import { X } from "lucide-react";
import { MarketStatus, StockCard, type StockCardData } from "@/components/watch";

/** Static, deterministic sample data so the preview never changes between renders. */
const SAMPLE: StockCardData[] = [
  {
    ticker: "AAPL",
    companyName: "Apple Inc",
    price: 336.13,
    change: -1.77,
    changePercent: -0.53,
    low: 332.53,
    high: 338.49,
    sparkline: [
      337.9, 338.2, 338.4, 337.6, 336.9, 337.4, 336.2, 335.4, 335.8, 335.1, 336.3, 334.2, 332.6,
      334.9, 336.0, 335.5, 336.13,
    ],
  },
  {
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    price: 222.27,
    change: 2.92,
    changePercent: 1.33,
    low: 218.03,
    high: 222.73,
    sparkline: [
      219.4, 220.6, 222.4, 221.0, 220.2, 220.4, 220.1, 220.6, 220.3, 218.1, 221.3, 221.6, 221.7,
      221.9, 222.0, 222.5, 222.27,
    ],
  },
  {
    ticker: "MSFT",
    companyName: "Microsoft Corp",
    price: 493.78,
    change: -4.19,
    changePercent: -0.84,
    low: 491.1,
    high: 498.65,
    sparkline: [
      497.9, 498.4, 497.6, 498.6, 496.2, 494.3, 494.9, 493.7, 493.1, 493.9, 492.4, 491.2, 492.8,
      494.1, 493.4, 494.0, 493.78,
    ],
  },
];

/** A faithful, non-interactive rendering of the Watch dashboard for the landing page. */
export function ProductPreview() {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-canvas p-6 shadow-[var(--shadow-pop)] md:p-10"
      aria-label="Preview of the Watch dashboard"
      role="img"
    >
      <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <p className="font-serif text-4xl leading-none tracking-tight text-ink md:text-5xl">
            Watch
          </p>
          <MarketStatus status={{ isOpen: false, label: "Market closed · Weekend" }} />
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div
            className="inline-flex items-center gap-0.5 rounded-full bg-canvas-deep p-1 font-mono text-sm"
            aria-hidden="true"
          >
            {["Live", "1H", "1D", "1W", "1M", "1Y"].map((label) => (
              <span
                key={label}
                className={
                  label === "1D"
                    ? "rounded-full bg-ink px-3.5 py-1.5 text-accent-foreground"
                    : "px-3.5 py-1.5 text-muted"
                }
              >
                {label}
              </span>
            ))}
          </div>
          <p className="font-mono text-sm text-muted">polling every 10s · modeled history</p>
        </div>
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <p className="font-serif text-2xl leading-none text-ink">Watchlist</p>
        <p className="font-mono text-sm text-muted">3 of 3</p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE.map((stock) => (
          <StockCard
            key={stock.ticker}
            data={stock}
            rangeLabel="1d"
            remove={<X className="size-4 shrink-0 text-faint" aria-hidden="true" />}
          />
        ))}
      </div>

      <p className="label-caps mt-8 text-muted">+ Add a line of three</p>
    </div>
  );
}
