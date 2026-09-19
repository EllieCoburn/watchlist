"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { addTicker, type ActionResult } from "@/lib/actions/watchlists";
import { cn } from "@/lib/utils";

type AddTickerSlotProps = {
  watchlistId: string;
  /** Highlight the first empty slot slightly so the eye knows where to start. */
  primary?: boolean;
};

/** An empty card slot in the grid: dashed outline with a small ticker form. */
export function AddTickerSlot({ watchlistId, primary }: AddTickerSlotProps) {
  const [state, action] = useActionState<ActionResult, FormData>(addTicker, {});
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        "flex min-h-[19rem] flex-col justify-between rounded-[var(--radius-lg)] border border-dashed p-6 transition-colors duration-150 md:p-7",
        primary ? "border-border-strong" : "border-border",
      )}
      noValidate
    >
      <input type="hidden" name="watchlistId" value={watchlistId} />
      <label htmlFor={inputId} className="label-caps flex items-center gap-2 text-muted">
        <Plus className="size-3.5" aria-hidden="true" />
        Add ticker
      </label>

      <div className="space-y-3">
        <input
          id={inputId}
          name="ticker"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          placeholder="AAPL"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? `${inputId}-error` : undefined}
          className="tabular h-12 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 font-mono text-lg uppercase tracking-[0.04em] text-ink placeholder:text-faint focus:border-border-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        {state.error ? (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-loss-text">
            {state.error}
          </p>
        ) : null}
        <SubmitButton variant="secondary" size="sm" pendingText="Adding…">
          Add to watchlist
        </SubmitButton>
      </div>
    </form>
  );
}
