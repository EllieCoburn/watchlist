import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "gain" | "loss" | "faint";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-canvas-deep text-ink-secondary",
  gain: "bg-gain-soft text-gain-text",
  loss: "bg-loss-soft text-loss-text",
  faint: "bg-surface-muted text-faint",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "label-caps inline-flex items-center rounded-[var(--radius-sm)] px-2 py-1",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
