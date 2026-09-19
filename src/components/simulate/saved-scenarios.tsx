"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteScenario } from "@/lib/actions/scenarios";
import type { Scenario } from "@/lib/data/scenarios";
import { computeScenario } from "@/lib/finance/scenario";
import { formatMoney, formatSignedMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

function DeleteButton({ id, ticker }: { id: string; ticker: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const r = await deleteScenario(id);
            if (r.error) setError(r.error);
          })
        }
        disabled={pending}
        aria-label={`Delete ${ticker} scenario`}
        className="rounded-full p-1.5 text-faint transition-colors hover:bg-canvas hover:text-loss-text disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      {error ? (
        <span role="alert" className="text-xs text-loss-text">
          {error}
        </span>
      ) : null}
    </>
  );
}

export function SavedScenarios({
  scenarios,
  activeId,
}: {
  scenarios: Scenario[];
  activeId: string | null;
}) {
  if (scenarios.length === 0) return null;
  return (
    <section aria-labelledby="saved-scenarios-heading" className="space-y-4">
      <h2 id="saved-scenarios-heading" className="font-serif text-2xl leading-tight text-ink">
        Saved scenarios
      </h2>
      <ul
        className="divide-y divide-border rounded-[var(--radius-lg)] border border-border/60 bg-surface shadow-[var(--shadow-card)]"
        role="list"
      >
        {scenarios.map((s) => {
          const r = computeScenario({
            ticker: s.ticker,
            entryPrice: s.entryPrice,
            sizingMode: "shares",
            amount: s.capital,
            shares: s.shares,
            targetPrice: s.targetPrice,
            stopPrice: s.stopPrice,
          });
          const active = s.id === activeId;
          return (
            <li
              key={s.id}
              className={cn(
                "flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 font-mono text-sm",
                active && "bg-surface-muted",
              )}
            >
              <Link
                href={`/app/simulate?scenario=${s.id}`}
                className="font-semibold tracking-[0.04em] text-ink underline-offset-4 hover:underline"
              >
                {s.ticker}
              </Link>
              <span className="tabular text-muted">at {formatMoney(s.entryPrice)}</span>
              <span className="tabular text-muted">{formatMoney(s.capital)}</span>
              <span className="tabular text-gain-text">
                {r.target ? formatSignedMoney(r.target.profit) : "—"}
              </span>
              <span className="tabular text-loss-text">
                {r.stop ? formatSignedMoney(r.stop.loss) : "—"}
              </span>
              <span className="tabular text-muted">
                {r.riskReward != null ? `${r.riskReward.toFixed(1)} : 1` : ""}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <DeleteButton id={s.id} ticker={s.ticker} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
