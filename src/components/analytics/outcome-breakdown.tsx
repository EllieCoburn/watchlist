import { cn } from "@/lib/utils";

type OutcomeBreakdownProps = { wins: number; losses: number; breakeven: number };

/** Wins / losses / break-even as one segmented bar with gaps and text labels. */
export function OutcomeBreakdown({ wins, losses, breakeven }: OutcomeBreakdownProps) {
  const total = wins + losses + breakeven;
  const segments = [
    { key: "wins", label: "Wins", count: wins, bar: "bg-gain-text", text: "text-gain-text" },
    { key: "losses", label: "Losses", count: losses, bar: "bg-loss-text", text: "text-loss-text" },
    {
      key: "breakeven",
      label: "Break-even",
      count: breakeven,
      bar: "bg-faint",
      text: "text-muted",
    },
  ];

  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <p className="label-caps text-muted">Outcomes</p>
      <p className="mt-1 text-sm text-muted">How your closed trades ended.</p>
      <div
        className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${wins} wins, ${losses} losses, ${breakeven} break-even`}
      >
        {total === 0 ? (
          <span className="flex-1 bg-canvas-deep" />
        ) : (
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <span
                key={s.key}
                className={cn("rounded-full", s.bar)}
                style={{ flexGrow: s.count, flexBasis: 0 }}
              />
            ))
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        {segments.map((s) => (
          <div key={s.key}>
            <dt className={cn("label-caps", s.text)}>{s.label}</dt>
            <dd className="tabular mt-1.5 font-mono text-2xl text-ink">
              {s.count}
              {total > 0 ? (
                <span className="ml-1.5 text-xs text-muted">
                  {Math.round((s.count / total) * 100)}%
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
