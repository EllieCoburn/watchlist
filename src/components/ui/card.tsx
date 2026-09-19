import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** White surface with a barely-there border and shadow, as in the reference. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border/60 bg-surface p-5 shadow-[var(--shadow-card)] md:p-6",
        className,
      )}
      {...props}
    />
  );
}
