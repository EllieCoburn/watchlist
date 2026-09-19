import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnalyticsMetricProps = {
  label: string;
  /** One plain-language sentence explaining the metric. */
  description: string;
  value: ReactNode;
  tone?: "ink" | "gain" | "loss" | "faint";
};

const TONES = {
  ink: "text-ink",
  gain: "text-gain-text",
  loss: "text-loss-text",
  faint: "text-muted",
};

export function AnalyticsMetric({ label, description, value, tone = "ink" }: AnalyticsMetricProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
      <p className="label-caps text-muted">{label}</p>
      <p className={cn("tabular mt-3 font-mono text-3xl leading-none", TONES[tone])}>{value}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
