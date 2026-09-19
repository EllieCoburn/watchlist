"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Notice } from "@/components/ui/notice";
import {
  convertScenarioToTrade,
  saveScenario,
  type ScenarioActionState,
} from "@/lib/actions/scenarios";

type ScenarioPayload = {
  ticker: string;
  entryPrice: number;
  capital: number;
  shares: number;
  targetPrice: number | null;
  stopPrice: number | null;
  scenarioId: string | null;
};

function HiddenFields({ payload }: { payload: ScenarioPayload }) {
  return (
    <>
      <input type="hidden" name="ticker" value={payload.ticker} />
      <input type="hidden" name="entryPrice" value={payload.entryPrice} />
      <input type="hidden" name="capital" value={payload.capital.toFixed(2)} />
      <input type="hidden" name="shares" value={payload.shares.toFixed(4)} />
      <input type="hidden" name="targetPrice" value={payload.targetPrice ?? ""} />
      <input type="hidden" name="stopPrice" value={payload.stopPrice ?? ""} />
      {payload.scenarioId ? (
        <input type="hidden" name="scenarioId" value={payload.scenarioId} />
      ) : null}
    </>
  );
}

/** "Save scenario" and "Plan this trade" — two small forms posting the simulator's current numbers. */
export function ScenarioActions({
  payload,
  disabled,
}: {
  payload: ScenarioPayload;
  disabled: boolean;
}) {
  const [saveState, saveAction] = useActionState<ScenarioActionState, FormData>(saveScenario, {});
  const [convertState, convertAction] = useActionState<ScenarioActionState, FormData>(
    convertScenarioToTrade,
    {},
  );
  const error = saveState.error ?? convertState.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={saveAction}>
          <HiddenFields payload={payload} />
          <SubmitButton variant="secondary" disabled={disabled} pendingText="Saving…">
            Save scenario
          </SubmitButton>
        </form>
        <form action={convertAction}>
          <HiddenFields payload={{ ...payload, scenarioId: saveState.id ?? payload.scenarioId }} />
          <SubmitButton disabled={disabled} pendingText="Creating…">
            Plan this trade
          </SubmitButton>
        </form>
        {saveState.ok ? (
          <p role="status" className="text-sm text-gain-text">
            Saved.{" "}
            <Link href="/app/simulate" className="underline underline-offset-4">
              See saved scenarios
            </Link>
          </p>
        ) : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
