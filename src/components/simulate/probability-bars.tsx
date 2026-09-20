import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

const pct = (p: number) => `${Math.round(p * 100)}%`;

type BarProps = {
  label: string;
  sublabel?: string;
  value: number;
  tone: "gain" | "loss" | "neutral";
};

function Bar({ label, sublabel, value, tone }: BarProps) {
  const fill =
    tone === "gain" ? "bg-gain-text" : tone === "loss" ? "bg-loss-text" : "bg-ink-secondary";
  const text = tone === "gain" ? "text-gain-text" : tone === "loss" ? "text-loss-text" : "text-ink";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-caps text-muted">
          {label}
          {sublabel ? <span className="tabular ml-2 text-ink">{sublabel}</span> : null}
        </p>
        <p className={cn("tabular font-mono text-2xl leading-none", text)}>{pct(value)}</p>
      </div>
      <div
        className="mt-2.5 h-2.5 w-full rounded-full bg-canvas-deep"
        role="img"
        aria-label={`${label} ${sublabel ?? ""}: ${pct(value)}`}
      >
        <div
          className={cn("h-full rounded-full", fill)}
          style={{ width: `${Math.max(1, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

type TouchProps = {
  target: number;
  stop: number;
  pTarget: number;
  pStop: number;
  paths: number;
};

/** "Touch target" versus "touch stop" as two bars. */
export function TouchProbabilities({ target, stop, pTarget, pStop, paths }: TouchProps) {
  return (
    <section
      className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8"
      aria-labelledby="touch-heading"
    >
      <p id="touch-heading" className="label-caps text-muted">
        {paths.toLocaleString("en-US")} simulated price paths
      </p>
      <div className="mt-6 space-y-6">
        <Bar label="Touch target" sublabel={formatMoney(target)} value={pTarget} tone="gain" />
        <Bar label="Touch stop" sublabel={formatMoney(stop)} value={pStop} tone="loss" />
      </div>
    </section>
  );
}

type FirstProps = { targetFirst: number; stopFirst: number; neither: number; both: number };

/** Which level is reached first: one segmented bar with gaps, plus the numbers. */
export function FirstLevelReached({ targetFirst, stopFirst, neither, both }: FirstProps) {
  const rows = [
    {
      key: "t",
      label: "Target first",
      value: targetFirst,
      bar: "bg-gain-text",
      text: "text-gain-text",
    },
    {
      key: "s",
      label: "Stop first",
      value: stopFirst,
      bar: "bg-loss-text",
      text: "text-loss-text",
    },
    { key: "n", label: "Neither", value: neither, bar: "bg-faint", text: "text-ink" },
  ];
  return (
    <section
      className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)] md:p-8"
      aria-labelledby="first-heading"
    >
      <p id="first-heading" className="label-caps text-muted">
        First level reached
      </p>
      <div
        className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Target first ${pct(targetFirst)}, stop first ${pct(stopFirst)}, neither ${pct(neither)}`}
      >
        {rows
          .filter((r) => r.value > 0)
          .map((r) => (
            <span
              key={r.key}
              className={cn("rounded-full", r.bar)}
              style={{ flexGrow: r.value, flexBasis: 0 }}
            />
          ))}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className={cn("label-caps", r.text)}>{r.label}</dt>
            <dd className="tabular mt-1.5 font-mono text-3xl leading-none text-ink">
              {pct(r.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        Both levels were touched in {pct(both)} of paths; those count under whichever level came
        first.
      </p>
    </section>
  );
}
