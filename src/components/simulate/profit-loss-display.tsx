import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

type OutcomeProps = {
  /** "target" renders as a potential profit, "stop" as a potential loss. */
  kind: "target" | "stop";
  price: number | null;
  amount: number | null;
  returnPercent: number | null;
  positionValue: number | null;
};

function Outcome({ kind, price, amount, returnPercent, positionValue }: OutcomeProps) {
  const isTarget = kind === "target";
  const hasData = price != null && amount != null;
  const positive = hasData && amount >= 0;
  const tone = !hasData ? "text-muted" : positive ? "text-gain-text" : "text-loss-text";
  const word = !hasData ? "" : positive ? "gain" : "loss";

  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="label-caps text-muted">
        {isTarget ? "If it reaches the target" : "If it hits the stop"}
      </p>
      <p className="mt-1 font-mono text-sm text-muted">
        {price != null ? formatMoney(price) : "Add a price to see this"}
      </p>
      <p className={cn("tabular mt-5 font-mono text-4xl leading-none", tone)}>
        {hasData ? formatSignedMoney(amount) : "—"}
        {hasData ? <span className="sr-only"> {word}</span> : null}
      </p>
      <p className={cn("tabular mt-2 font-mono text-sm", tone)}>
        {hasData && returnPercent != null ? formatSignedPercent(returnPercent) : " "}
      </p>
      <dl className="mt-5 flex justify-between border-t border-border pt-4 font-mono text-sm">
        <dt className="text-muted">Position value</dt>
        <dd className="tabular text-ink">
          {positionValue != null ? formatMoney(positionValue) : "—"}
        </dd>
      </dl>
    </div>
  );
}

type ProfitLossDisplayProps = {
  target: { price: number; profit: number; returnPercent: number; positionValue: number } | null;
  stop: { price: number; loss: number; returnPercent: number; positionValue: number } | null;
};

export function ProfitLossDisplay({ target, stop }: ProfitLossDisplayProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Outcome
        kind="target"
        price={target?.price ?? null}
        amount={target?.profit ?? null}
        returnPercent={target?.returnPercent ?? null}
        positionValue={target?.positionValue ?? null}
      />
      <Outcome
        kind="stop"
        price={stop?.price ?? null}
        amount={stop?.loss ?? null}
        returnPercent={stop?.returnPercent ?? null}
        positionValue={stop?.positionValue ?? null}
      />
    </div>
  );
}
