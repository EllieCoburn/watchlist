import { formatMoney } from "@/lib/finance/money";

type RiskRewardDisplayProps = {
  ratio: number | null;
  reward: number | null;
  risk: number | null;
};

/** "Risk / reward 2.0 : 1" with a proportional bar and a one-line plain explanation. */
export function RiskRewardDisplay({ ratio, reward, risk }: RiskRewardDisplayProps) {
  const hasRatio = ratio != null && reward != null && risk != null;
  const riskShare = hasRatio ? 1 / (1 + ratio) : 0.5;
  const label = hasRatio ? `${ratio.toFixed(1)} : 1` : "—";

  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-caps text-muted">Risk / reward</p>
        <p className="tabular font-mono text-2xl leading-none text-ink">{label}</p>
      </div>
      <div
        className="mt-5 flex h-2 overflow-hidden rounded-full bg-canvas-deep"
        role="img"
        aria-label={
          hasRatio
            ? `Potential loss ${formatMoney(Math.abs(risk))} versus potential gain ${formatMoney(reward)}`
            : "Risk and reward not yet defined"
        }
      >
        {hasRatio ? (
          <>
            <span className="bg-loss" style={{ width: `${riskShare * 100}%` }} />
            <span className="bg-gain" style={{ width: `${(1 - riskShare) * 100}%` }} />
          </>
        ) : null}
      </div>
      <div className="mt-2 flex justify-between font-mono text-xs text-muted" aria-hidden="true">
        <span>{hasRatio ? `risk ${formatMoney(Math.abs(risk))}` : "risk"}</span>
        <span>{hasRatio ? `reward ${formatMoney(reward)}` : "reward"}</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {hasRatio
          ? `For every $1 this plan risks, it aims to make $${ratio.toFixed(2)}. Whether that happens is unknown.`
          : "Add a target above the current price and a stop below it to see the ratio."}
      </p>
    </div>
  );
}
