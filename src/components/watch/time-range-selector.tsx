"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export const TIME_RANGES = ["live", "1H", "1D", "1W", "1M", "1Y"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

const LABELS: Record<TimeRange, string> = {
  live: "Live",
  "1H": "1H",
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "1Y": "1Y",
};

type TimeRangeSelectorProps = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
};

/** Pill segmented control. Behaves as a radio group: arrow keys move between options. */
export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  const groupId = useId();

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = TIME_RANGES.indexOf(value);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % TIME_RANGES.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + TIME_RANGES.length) % TIME_RANGES.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TIME_RANGES.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(TIME_RANGES[next]);
    document.getElementById(`${groupId}-${TIME_RANGES[next]}`)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-canvas-deep p-1 font-mono text-sm",
        className,
      )}
    >
      {TIME_RANGES.map((range) => {
        const active = range === value;
        return (
          <button
            key={range}
            id={`${groupId}-${range}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(range)}
            className={cn(
              "h-8 rounded-full px-3.5 transition-colors duration-150",
              active ? "bg-ink text-accent-foreground" : "text-muted hover:text-ink",
            )}
          >
            {LABELS[range]}
          </button>
        );
      })}
    </div>
  );
}
