import { cn } from "@/lib/utils";

export type MarketStatusData = {
  isOpen: boolean;
  /** Ready-to-display label, e.g. "MARKET OPEN" or "MARKET CLOSED · WEEKEND". */
  label: string;
};

export function MarketStatus({
  status,
  className,
}: {
  status: MarketStatusData;
  className?: string;
}) {
  return (
    <p className={cn("label-caps flex items-center gap-2.5 text-muted", className)}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", status.isOpen ? "bg-gain" : "bg-faint")}
      />
      <span>{status.label}</span>
    </p>
  );
}
