"use client";

import { Plus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { TickerCombobox } from "@/components/ui/ticker-combobox";
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

  // Clear the field after a successful add by remounting the combobox (state adjustment during render).
  const [resetKey, setResetKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setResetKey((k) => k + 1);
  }

  return (
    <form
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
        <TickerCombobox
          id={inputId}
          key={resetKey}
          placeholder="AAPL or Apple"
          className="h-12 text-lg"
          invalid={Boolean(state.error)}
          describedBy={state.error ? `${inputId}-error` : undefined}
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
