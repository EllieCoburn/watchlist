"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import type { TradeFilter, TradeSort } from "@/lib/finance/trades";
import { cn } from "@/lib/utils";

const FILTERS: { value: TradeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "planned", label: "Planned" },
];

const SORTS: { value: TradeSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "largest-win", label: "Largest win" },
  { value: "largest-loss", label: "Largest loss" },
];

type TradeFiltersProps = { filter: TradeFilter; sort: TradeSort; search: string };

/** Status tabs, ticker search and sort. State lives in the URL so links are shareable and back works. */
export function TradeFilters({ filter, sort, search }: TradeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const id = useId();

  function update(patch: Partial<TradeFiltersProps>) {
    const next = new URLSearchParams(params.toString());
    const merged = { filter, sort, search, ...patch };
    if (merged.filter === "all") next.delete("status");
    else next.set("status", merged.filter);
    if (merged.sort === "newest") next.delete("sort");
    else next.set("sort", merged.sort);
    if (merged.search.trim()) next.set("q", merged.search.trim().toUpperCase());
    else next.delete("q");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div
      className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      aria-busy={pending}
    >
      <div
        role="radiogroup"
        aria-label="Status"
        className="inline-flex self-start rounded-full bg-canvas-deep p-1 font-mono text-sm"
      >
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update({ filter: f.value })}
              className={cn(
                "h-8 rounded-full px-3.5 transition-colors duration-150",
                active ? "bg-ink text-accent-foreground" : "text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          Search by ticker
        </label>
        <input
          id={`${id}-q`}
          type="search"
          defaultValue={search}
          placeholder="Ticker"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => update({ search: e.target.value })}
          className="h-10 w-36 rounded-[var(--radius-sm)] border border-border bg-surface px-3 font-mono text-sm uppercase tracking-[0.04em] text-ink placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-faint focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <label htmlFor={`${id}-sort`} className="sr-only">
          Sort by
        </label>
        <select
          id={`${id}-sort`}
          value={sort}
          onChange={(e) => update({ sort: e.target.value as TradeSort })}
          className="h-10 rounded-[var(--radius-sm)] border border-border bg-surface px-3 pr-8 text-sm text-ink focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
