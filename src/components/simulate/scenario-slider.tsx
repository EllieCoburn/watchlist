"use client";

import { useId } from "react";
import {
  formatMoney,
  formatPrice,
  formatSignedMoney,
  formatSignedPercent,
} from "@/lib/finance/money";
import { computeHypothetical, hypotheticalRange } from "@/lib/finance/scenario";
import { cn } from "@/lib/utils";

type ScenarioSliderProps = {
  ticker: string;
  entryPrice: number;
  shares: number;
  cost: number;
  targetPrice: number | null;
  stopPrice: number | null;
  value: number;
  onChange: (price: number) => void;
};

/** Drag a hypothetical price and watch the position value, gain and loss update. */
export function ScenarioSlider({
  ticker,
  entryPrice,
  shares,
  cost,
  targetPrice,
  stopPrice,
  value,
  onChange,
}: ScenarioSliderProps) {
  const id = useId();
  const range = hypotheticalRange(entryPrice, targetPrice, stopPrice);
  const h = computeHypothetical(shares, entryPrice, value);
  const positive = h.profitLoss > 0;
  const negative = h.profitLoss < 0;
  const tone = positive ? "text-gain-text" : negative ? "text-loss-text" : "text-ink";
  const pct = (p: number) =>
    `${Math.min(100, Math.max(0, ((p - range.min) / (range.max - range.min)) * 100))}%`;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8"
    >
      <p className="label-caps text-muted">Hypothetical · drag to explore</p>
      <h3
        id={`${id}-heading`}
        className="mt-3 font-serif text-3xl leading-tight text-ink md:text-4xl"
      >
        If {ticker || "the stock"} reaches{" "}
        <span className="tabular font-mono text-[0.9em]">{formatMoney(value)}</span>
      </h3>

      <div className="mt-8">
        <label htmlFor={`${id}-range`} className="sr-only">
          Hypothetical price
        </label>
        <div className="relative pt-3">
          {/* Tick marks for stop, current price and target sit just above the track. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-3" aria-hidden="true">
            {stopPrice != null && stopPrice > 0 ? (
              <span
                className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-loss"
                style={{ left: pct(stopPrice) }}
              />
            ) : null}
            <span
              className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-ink"
              style={{ left: pct(entryPrice) }}
            />
            {targetPrice != null && targetPrice > 0 ? (
              <span
                className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-gain"
                style={{ left: pct(targetPrice) }}
              />
            ) : null}
          </div>
          <input
            id={`${id}-range`}
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-valuetext={formatMoney(value)}
            className="range-calm w-full"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted">
          {stopPrice != null && stopPrice > 0 ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-0.5 rounded-full bg-loss" />
              stop <span className="tabular text-loss-text">{formatPrice(stopPrice)}</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-0.5 rounded-full bg-ink" />
            now <span className="tabular text-ink">{formatPrice(entryPrice)}</span>
          </span>
          {targetPrice != null && targetPrice > 0 ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-0.5 rounded-full bg-gain" />
              target <span className="tabular text-gain-text">{formatPrice(targetPrice)}</span>
            </span>
          ) : null}
          <span className="ml-auto">
            {formatPrice(range.min)} – {formatPrice(range.max)}
          </span>
        </div>
      </div>

      <dl className="mt-6 grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
        <div>
          <dt className="label-caps text-muted">Investment</dt>
          <dd className="tabular mt-2 font-mono text-2xl text-ink">{formatMoney(cost)}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted">New value</dt>
          <dd className="tabular mt-2 font-mono text-2xl text-ink">
            {formatMoney(h.positionValue)}
          </dd>
        </div>
        <div>
          <dt className="label-caps text-muted">
            {positive ? "Potential profit" : negative ? "Potential loss" : "Change"}
          </dt>
          <dd className={cn("tabular mt-2 font-mono text-2xl", tone)}>
            {formatSignedMoney(h.profitLoss)}{" "}
            <span className="text-sm">{formatSignedPercent(h.returnPercent)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
