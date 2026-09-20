"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { SimulateResponse } from "@/app/api/simulate/route";
import { MAX_CUSTOM_DAYS } from "@/lib/quant/calendar";
import { cn } from "@/lib/utils";
import { SimulationReport } from "./simulation-report";

export type HorizonChoice = "today" | "next" | "custom";

type ProbabilitySimulatorProps = {
  ticker: string;
  entry: number | null;
  target: number | null;
  stop: number | null;
  shares: number | null;
  /** Whether the plan above is complete enough to run. */
  ready: boolean;
};

/** Runs the server-side probability calculator for the plan entered above and shows the report. */
export function ProbabilitySimulator({
  ticker,
  entry,
  target,
  stop,
  shares,
  ready,
}: ProbabilitySimulatorProps) {
  const id = useId();
  const [horizon, setHorizon] = useState<HorizonChoice>("next");
  const [days, setDays] = useState("5");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SimulateResponse | null>(null);

  async function run() {
    if (!ready || entry == null || target == null || stop == null) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          entry,
          target,
          stop,
          shares,
          horizon:
            horizon === "custom" ? { type: "custom", days: Number(days) } : { type: horizon },
        }),
      });
      const json = (await res.json()) as SimulateResponse | { error: string };
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : "The simulation could not run.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("The simulation could not run. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const options: { value: HorizonChoice; label: string; hint: string }[] = [
    { value: "today", label: "Today", hint: "Rest of this session" },
    { value: "next", label: "Next trading day", hint: "Tomorrow, including the open" },
    { value: "custom", label: "Custom", hint: "A number of trading days" },
  ];

  return (
    <section className="space-y-6" aria-labelledby={`${id}-heading`}>
      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 id={`${id}-heading`} className="font-serif text-2xl leading-tight text-ink">
              Probability of reaching each level
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Simulates tens of thousands of price paths from {ticker || "the stock"}’s own daily
              history and counts how often the target or the stop is touched, and which comes first.
              A first-passage model, not a closing-price forecast.
            </p>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="block text-sm font-medium text-ink-secondary">Time horizon</legend>
          <div role="radiogroup" aria-label="Time horizon" className="mt-2 flex flex-wrap gap-2">
            {options.map((o) => {
              const active = horizon === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setHorizon(o.value)}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-4 py-2.5 text-left transition-colors duration-150",
                    active
                      ? "border-ink bg-ink text-accent-foreground"
                      : "border-border bg-surface text-ink hover:border-border-strong",
                  )}
                >
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span
                    className={cn(
                      "block text-xs",
                      active ? "text-accent-foreground/80" : "text-muted",
                    )}
                  >
                    {o.hint}
                  </span>
                </button>
              );
            })}
            {horizon === "custom" ? (
              <div className="w-40">
                <Field id={`${id}-days`} label="Trading days">
                  <Input
                    id={`${id}-days`}
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    min={1}
                    max={MAX_CUSTOM_DAYS}
                    type="number"
                    className="tabular font-mono"
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!ready || pending} aria-busy={pending}>
            {pending ? "Simulating…" : data ? "Run again" : "Run simulation"}
          </Button>
          {!ready ? (
            <p className="text-sm text-muted">
              Enter a ticker, entry, target above entry and stop below entry.
            </p>
          ) : null}
          {pending ? (
            <p className="text-sm text-muted" role="status">
              Fetching history and running up to 100,000 paths…
            </p>
          ) : null}
        </div>
        {error ? (
          <Notice tone="error" className="mt-5">
            {error}
          </Notice>
        ) : null}
      </div>

      {data ? <SimulationReport data={data} /> : null}
    </section>
  );
}
