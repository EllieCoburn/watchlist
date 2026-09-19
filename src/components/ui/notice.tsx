import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "success" | "error";

const styles: Record<NoticeTone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-border bg-surface-muted text-ink-secondary", Icon: Info },
  success: { box: "border-gain/40 bg-gain-soft text-gain-text", Icon: CheckCircle2 },
  error: { box: "border-loss/40 bg-loss-soft text-loss-text", Icon: AlertCircle },
};

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-3 text-sm leading-relaxed",
        box,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
