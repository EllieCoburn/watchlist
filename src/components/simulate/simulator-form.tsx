"use client";

import { useId, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SizingMode } from "@/lib/finance/scenario";
import { cn } from "@/lib/utils";

export type SimulatorFormValues = {
  ticker: string;
  entryPrice: string;
  sizingMode: SizingMode;
  amount: string;
  shares: string;
  targetPrice: string;
  stopPrice: string;
};

type SimulatorFormProps = {
  values: SimulatorFormValues;
  onChange: (patch: Partial<SimulatorFormValues>) => void;
  /** Fetches the latest price for the ticker; returns null when unavailable. */
  onUseCurrentPrice: () => Promise<string | null>;
  errors: Partial<Record<keyof SimulatorFormValues, string>>;
  quoteEnabled: boolean;
};

export function SimulatorForm({
  values,
  onChange,
  onUseCurrentPrice,
  errors,
  quoteEnabled,
}: SimulatorFormProps) {
  const id = useId();
  const [fetching, setFetching] = useState(false);
  const [fetchNote, setFetchNote] = useState<string | null>(null);

  async function useCurrentPrice() {
    setFetching(true);
    setFetchNote(null);
    const note = await onUseCurrentPrice();
    setFetchNote(note);
    setFetching(false);
  }

  const money = "tabular font-mono placeholder:font-sans placeholder:normal-case";

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-ticker`} label="Ticker" error={errors.ticker}>
          <Input
            id={`${id}-ticker`}
            value={values.ticker}
            onChange={(e) => onChange({ ticker: e.target.value.toUpperCase() })}
            placeholder="PLTR"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            className="font-mono uppercase tracking-[0.04em]"
            aria-invalid={Boolean(errors.ticker)}
          />
        </Field>
        <Field id={`${id}-entry`} label="Current stock price" error={errors.entryPrice}>
          <div className="flex gap-2">
            <Input
              id={`${id}-entry`}
              inputMode="decimal"
              value={values.entryPrice}
              onChange={(e) => onChange({ entryPrice: e.target.value })}
              placeholder="175.00"
              className={money}
              aria-invalid={Boolean(errors.entryPrice)}
            />
            {quoteEnabled ? (
              <button
                type="button"
                onClick={useCurrentPrice}
                disabled={fetching || !values.ticker}
                className="label-caps shrink-0 rounded-[var(--radius-sm)] border border-border px-3 text-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-50"
              >
                {fetching ? "…" : "Use latest"}
              </button>
            ) : null}
          </div>
          {fetchNote ? <p className="mt-1.5 text-xs text-muted">{fetchNote}</p> : null}
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="block text-sm font-medium text-ink-secondary">Position size</legend>
        <div
          role="radiogroup"
          aria-label="Size by"
          className="inline-flex rounded-full bg-canvas-deep p-1 font-mono text-sm"
        >
          {(["amount", "shares"] as const).map((mode) => {
            const active = values.sizingMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ sizingMode: mode })}
                className={cn(
                  "h-8 rounded-full px-4 transition-colors duration-150",
                  active ? "bg-ink text-accent-foreground" : "text-muted hover:text-ink",
                )}
              >
                {mode === "amount" ? "Amount" : "Shares"}
              </button>
            );
          })}
        </div>
        {values.sizingMode === "amount" ? (
          <Field id={`${id}-amount`} label="Investment amount" error={errors.amount}>
            <Input
              id={`${id}-amount`}
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              placeholder="10,000"
              className={money}
              aria-invalid={Boolean(errors.amount)}
            />
          </Field>
        ) : (
          <Field id={`${id}-shares`} label="Number of shares" error={errors.shares}>
            <Input
              id={`${id}-shares`}
              inputMode="decimal"
              value={values.shares}
              onChange={(e) => onChange({ shares: e.target.value })}
              placeholder="57.14"
              className={money}
              aria-invalid={Boolean(errors.shares)}
            />
          </Field>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${id}-target`}
          label="Target price"
          hint="Where you would take profit."
          error={errors.targetPrice}
        >
          <Input
            id={`${id}-target`}
            inputMode="decimal"
            value={values.targetPrice}
            onChange={(e) => onChange({ targetPrice: e.target.value })}
            placeholder="177.00"
            className={money}
            aria-invalid={Boolean(errors.targetPrice)}
          />
        </Field>
        <Field
          id={`${id}-stop`}
          label="Stop price"
          hint="Where you would accept the loss."
          error={errors.stopPrice}
        >
          <Input
            id={`${id}-stop`}
            inputMode="decimal"
            value={values.stopPrice}
            onChange={(e) => onChange({ stopPrice: e.target.value })}
            placeholder="174.00"
            className={money}
            aria-invalid={Boolean(errors.stopPrice)}
          />
        </Field>
      </div>
    </div>
  );
}
