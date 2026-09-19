import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/** Serif heading, one sentence, one action. No illustrations. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-12 md:px-10">
      <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">{description}</p>
      {action}
    </div>
  );
}
