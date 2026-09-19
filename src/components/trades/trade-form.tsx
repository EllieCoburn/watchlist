"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TickerCombobox } from "@/components/ui/ticker-combobox";
import { Notice } from "@/components/ui/notice";
import { createTrade, updateTrade, type TradeFormState } from "@/lib/actions/trades";
import type { Trade } from "@/lib/finance/trades";
import type { TradeStatus } from "@/lib/supabase/types";

type TradeFormProps = {
  trade?: Trade;
  /** Prefill for a brand-new trade (e.g. from a stock card). */
  defaults?: Partial<Pick<Trade, "ticker" | "companyName" | "entryPrice">>;
};

const STATUS_OPTIONS: { value: TradeStatus; label: string; hint: string }[] = [
  { value: "planned", label: "Planned", hint: "Not entered yet" },
  { value: "open", label: "Open", hint: "Currently holding" },
  { value: "closed", label: "Closed", hint: "Exited" },
  { value: "cancelled", label: "Cancelled", hint: "Never entered" },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const money = "tabular font-mono placeholder:font-sans";

export function TradeForm({ trade, defaults }: TradeFormProps) {
  const editing = Boolean(trade);
  const [state, action] = useActionState<TradeFormState, FormData>(
    editing ? updateTrade : createTrade,
    {},
  );
  const [status, setStatus] = useState<TradeStatus>(trade?.status ?? "planned");
  const id = useId();
  const e = state.fieldErrors ?? {};
  const showExit = status === "closed";

  return (
    <form action={action} className="space-y-10" noValidate>
      {trade ? <input type="hidden" name="id" value={trade.id} /> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <section className="space-y-5" aria-labelledby={`${id}-basics`}>
        <h2 id={`${id}-basics`} className="font-serif text-2xl leading-tight text-ink">
          The trade
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id={`${id}-ticker`} label="Ticker" error={e.ticker}>
            <TickerCombobox
              id={`${id}-ticker`}
              defaultValue={trade?.ticker ?? defaults?.ticker ?? ""}
              placeholder="AAPL or Apple"
              required
              invalid={Boolean(e.ticker)}
              onSelect={(m) => {
                const company = document.getElementById(`${id}-company`) as HTMLInputElement | null;
                if (company && !company.value) company.value = m.companyName;
              }}
            />
          </Field>
          <Field
            id={`${id}-company`}
            label="Company"
            hint="Optional. Filled in automatically when known."
          >
            <Input
              id={`${id}-company`}
              name="companyName"
              defaultValue={trade?.companyName ?? defaults?.companyName ?? ""}
              maxLength={120}
            />
          </Field>
          <Field id={`${id}-status`} label="Status" error={e.status}>
            <Select
              id={`${id}-status`}
              name="status"
              value={status}
              onChange={(ev) => setStatus(ev.target.value as TradeStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} · {o.hint}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby={`${id}-entry`}>
        <h2 id={`${id}-entry`} className="font-serif text-2xl leading-tight text-ink">
          Entry
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id={`${id}-entryPrice`} label="Entry price" error={e.entryPrice}>
            <Input
              id={`${id}-entryPrice`}
              name="entryPrice"
              inputMode="decimal"
              defaultValue={trade?.entryPrice ?? defaults?.entryPrice ?? ""}
              placeholder="175.00"
              className={money}
              aria-invalid={Boolean(e.entryPrice)}
            />
          </Field>
          <Field id={`${id}-entryDate`} label="Entry date" error={e.entryDate}>
            <Input
              id={`${id}-entryDate`}
              name="entryDate"
              type="date"
              defaultValue={trade?.entryDate ?? (editing ? "" : today())}
              className="font-mono"
              aria-invalid={Boolean(e.entryDate)}
            />
          </Field>
          <Field id={`${id}-entryTime`} label="Entry time" hint="Optional." error={e.entryTime}>
            <Input
              id={`${id}-entryTime`}
              name="entryTime"
              type="time"
              defaultValue={trade?.entryTime ?? ""}
              className="font-mono"
              aria-invalid={Boolean(e.entryTime)}
            />
          </Field>
          <Field id={`${id}-shares`} label="Shares" error={e.shares}>
            <Input
              id={`${id}-shares`}
              name="shares"
              inputMode="decimal"
              defaultValue={trade?.shares ?? ""}
              placeholder="57.14"
              className={money}
              aria-invalid={Boolean(e.shares)}
            />
          </Field>
          <Field
            id={`${id}-capital`}
            label="Capital invested"
            hint="Optional. Defaults to shares × entry price."
            error={e.capital}
          >
            <Input
              id={`${id}-capital`}
              name="capital"
              inputMode="decimal"
              defaultValue={trade?.capital ?? ""}
              placeholder="10,000"
              className={money}
              aria-invalid={Boolean(e.capital)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby={`${id}-plan`}>
        <h2 id={`${id}-plan`} className="font-serif text-2xl leading-tight text-ink">
          Plan
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id={`${id}-target`} label="Target price" hint="Optional." error={e.targetPrice}>
            <Input
              id={`${id}-target`}
              name="targetPrice"
              inputMode="decimal"
              defaultValue={trade?.targetPrice ?? ""}
              placeholder="177.00"
              className={money}
              aria-invalid={Boolean(e.targetPrice)}
            />
          </Field>
          <Field id={`${id}-stop`} label="Stop price" hint="Optional." error={e.stopPrice}>
            <Input
              id={`${id}-stop`}
              name="stopPrice"
              inputMode="decimal"
              defaultValue={trade?.stopPrice ?? ""}
              placeholder="174.00"
              className={money}
              aria-invalid={Boolean(e.stopPrice)}
            />
          </Field>
        </div>
      </section>

      {showExit ? (
        <section className="space-y-5" aria-labelledby={`${id}-exit`}>
          <h2 id={`${id}-exit`} className="font-serif text-2xl leading-tight text-ink">
            Exit
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id={`${id}-exitPrice`} label="Exit price" error={e.exitPrice}>
              <Input
                id={`${id}-exitPrice`}
                name="exitPrice"
                inputMode="decimal"
                defaultValue={trade?.exitPrice ?? ""}
                placeholder="177.40"
                className={money}
                aria-invalid={Boolean(e.exitPrice)}
              />
            </Field>
            <Field id={`${id}-exitDate`} label="Exit date" error={e.exitDate}>
              <Input
                id={`${id}-exitDate`}
                name="exitDate"
                type="date"
                defaultValue={trade?.exitDate ?? ""}
                className="font-mono"
                aria-invalid={Boolean(e.exitDate)}
              />
            </Field>
            <Field id={`${id}-exitTime`} label="Exit time" hint="Optional." error={e.exitTime}>
              <Input
                id={`${id}-exitTime`}
                name="exitTime"
                type="time"
                defaultValue={trade?.exitTime ?? ""}
                className="font-mono"
                aria-invalid={Boolean(e.exitTime)}
              />
            </Field>
          </div>
        </section>
      ) : (
        <>
          <input type="hidden" name="exitPrice" value={trade?.exitPrice ?? ""} />
          <input type="hidden" name="exitDate" value={trade?.exitDate ?? ""} />
          <input type="hidden" name="exitTime" value={trade?.exitTime ?? ""} />
        </>
      )}

      <section className="space-y-5" aria-labelledby={`${id}-notes`}>
        <h2 id={`${id}-notes`} className="font-serif text-2xl leading-tight text-ink">
          Notes
        </h2>
        <Field
          id={`${id}-notesField`}
          label="Notes"
          hint="Anything worth remembering about this trade."
        >
          <Textarea
            id={`${id}-notesField`}
            name="notes"
            defaultValue={trade?.notes ?? ""}
            maxLength={2000}
          />
        </Field>
      </section>

      <section className="space-y-5" aria-labelledby={`${id}-reflection`}>
        <div>
          <h2 id={`${id}-reflection`} className="font-serif text-2xl leading-tight text-ink">
            Reflection
          </h2>
          <p className="mt-1 text-sm text-muted">
            All optional. Come back to these whenever you like.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id={`${id}-why`} label="Why did I enter?">
            <Textarea
              id={`${id}-why`}
              name="entryReason"
              defaultValue={trade?.entryReason ?? ""}
              maxLength={2000}
              className="min-h-24"
            />
          </Field>
          <Field id={`${id}-what`} label="What happened?">
            <Textarea
              id={`${id}-what`}
              name="reflection"
              defaultValue={trade?.reflection ?? ""}
              maxLength={2000}
              className="min-h-24"
            />
          </Field>
          <Field id={`${id}-diff`} label="What would I do differently?">
            <Textarea
              id={`${id}-diff`}
              name="improvement"
              defaultValue={trade?.improvement ?? ""}
              maxLength={2000}
              className="min-h-24"
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-ink-secondary">
              Did I follow my plan?
            </legend>
            <div className="flex gap-4 pt-1 text-sm text-ink">
              {[
                { v: "", l: "Not sure yet" },
                { v: "yes", l: "Yes" },
                { v: "no", l: "No" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="followedPlan"
                    value={o.v}
                    defaultChecked={
                      (trade?.followedPlan == null ? "" : trade.followedPlan ? "yes" : "no") === o.v
                    }
                    className="accent-ink"
                  />
                  {o.l}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-6">
        <Link
          href={trade ? `/app/trades/${trade.id}` : "/app/trades"}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
        <SubmitButton pendingText="Saving…">{editing ? "Save changes" : "Log trade"}</SubmitButton>
      </div>
    </form>
  );
}
