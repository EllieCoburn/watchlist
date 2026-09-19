"use client";

import { useState } from "react";
import { Disclaimer } from "@/components/ui/disclaimer";
import { formatMoney, formatShares } from "@/lib/finance/money";
import { computeScenario, type ScenarioInput } from "@/lib/finance/scenario";
import { parseOptionalPositiveNumber, parsePositiveNumber } from "@/lib/validation/numbers";
import type { WatchSnapshot } from "@/lib/market-data/provider";
import { ProfitLossDisplay } from "./profit-loss-display";
import { RiskRewardDisplay } from "./risk-reward-display";
import { ScenarioActions } from "./scenario-actions";
import { ScenarioSlider } from "./scenario-slider";
import { SimulatorForm, type SimulatorFormValues } from "./simulator-form";

export type TradeSimulatorProps = {
  initialValues?: Partial<SimulatorFormValues>;
  /** The saved scenario these values came from, if any. */
  scenarioId?: string | null;
  /** Whether "Use latest" may call the quotes API (false in the dev preview). */
  quoteEnabled?: boolean;
};

export const EXAMPLE_VALUES: SimulatorFormValues = {
  ticker: "PLTR",
  entryPrice: "175.00",
  sizingMode: "amount",
  amount: "10000",
  shares: "",
  targetPrice: "177.00",
  stopPrice: "174.00",
};

function toInput(v: SimulatorFormValues): {
  input: ScenarioInput;
  errors: Partial<Record<keyof SimulatorFormValues, string>>;
} {
  const errors: Partial<Record<keyof SimulatorFormValues, string>> = {};
  const entryPrice = parsePositiveNumber(v.entryPrice);
  const amount = parsePositiveNumber(v.amount);
  const shares = parsePositiveNumber(v.shares);
  const target = parseOptionalPositiveNumber(v.targetPrice);
  const stop = parseOptionalPositiveNumber(v.stopPrice);

  if (v.entryPrice.trim() && !entryPrice) errors.entryPrice = "Enter a price above zero.";
  if (v.sizingMode === "amount" && v.amount.trim() && !amount)
    errors.amount = "Enter an amount above zero.";
  if (v.sizingMode === "shares" && v.shares.trim() && !shares)
    errors.shares = "Enter a number of shares above zero.";
  if (target.invalid) errors.targetPrice = "Enter a price above zero.";
  if (stop.invalid) errors.stopPrice = "Enter a price above zero.";
  if (entryPrice && target.value != null && target.value <= entryPrice)
    errors.targetPrice = "Usually above the current price.";
  if (entryPrice && stop.value != null && stop.value >= entryPrice)
    errors.stopPrice = "Usually below the current price.";

  return {
    input: {
      ticker: v.ticker.trim().toUpperCase(),
      entryPrice: entryPrice ?? 0,
      sizingMode: v.sizingMode,
      amount: amount ?? 0,
      shares: shares ?? 0,
      targetPrice: target.value,
      stopPrice: stop.value,
    },
    errors,
  };
}

export function TradeSimulator({
  initialValues,
  scenarioId = null,
  quoteEnabled = true,
}: TradeSimulatorProps) {
  const [values, setValues] = useState<SimulatorFormValues>({
    ...EXAMPLE_VALUES,
    ...initialValues,
  });
  const { input, errors } = toInput(values);
  const result = computeScenario(input);

  // Hypothetical price follows the entry price until the user drags the slider.
  const [hypo, setHypo] = useState<{ price: number; basedOn: number }>({
    price: input.entryPrice,
    basedOn: input.entryPrice,
  });
  if (hypo.basedOn !== input.entryPrice)
    setHypo({ price: input.entryPrice, basedOn: input.entryPrice });

  function patch(next: Partial<SimulatorFormValues>) {
    setValues((prev) => ({ ...prev, ...next }));
  }

  async function useCurrentPrice(): Promise<string | null> {
    const ticker = values.ticker.trim().toUpperCase();
    if (!ticker) return "Enter a ticker first.";
    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(ticker)}&range=1D`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as WatchSnapshot;
      const q = data.quotes[ticker];
      if (!q) return "No price available for that ticker.";
      patch({ entryPrice: q.price.toFixed(2) });
      return `${q.companyName ?? ticker} · ${data.dataLabel}`;
    } catch {
      return "Could not fetch a price right now.";
    }
  }

  const isExample = !initialValues;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-2xl leading-tight text-ink">The plan</h2>
              {isExample ? (
                <p className="label-caps text-faint">Example · change anything</p>
              ) : null}
            </div>
            <SimulatorForm
              values={values}
              onChange={patch}
              onUseCurrentPrice={useCurrentPrice}
              errors={errors}
              quoteEnabled={quoteEnabled}
            />
            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 font-mono text-sm">
              <div>
                <dt className="label-caps text-muted">Shares</dt>
                <dd className="tabular mt-1.5 text-lg text-ink">
                  {result.valid ? formatShares(result.shares) : "—"}
                </dd>
              </div>
              <div>
                <dt className="label-caps text-muted">Cost</dt>
                <dd className="tabular mt-1.5 text-lg text-ink">
                  {result.valid ? formatMoney(result.cost) : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <ScenarioActions
            disabled={!result.valid || !input.ticker}
            payload={{
              ticker: input.ticker,
              entryPrice: input.entryPrice,
              capital: result.cost,
              shares: result.shares,
              targetPrice: input.targetPrice,
              stopPrice: input.stopPrice,
              scenarioId,
            }}
          />
        </div>

        <div className="space-y-4">
          <p className="label-caps text-muted">Hypothetical outcomes</p>
          <ProfitLossDisplay target={result.target} stop={result.stop} />
          <RiskRewardDisplay
            ratio={result.riskReward}
            reward={result.target?.profit ?? null}
            risk={result.stop?.loss ?? null}
          />
        </div>
      </div>

      {result.valid ? (
        <ScenarioSlider
          ticker={input.ticker}
          entryPrice={input.entryPrice}
          shares={result.shares}
          cost={result.cost}
          targetPrice={input.targetPrice}
          stopPrice={input.stopPrice}
          value={hypo.price}
          onChange={(price) => setHypo({ price, basedOn: input.entryPrice })}
        />
      ) : null}

      <Disclaimer />
    </div>
  );
}
