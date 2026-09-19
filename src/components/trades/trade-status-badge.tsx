import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TradeStatus } from "@/lib/supabase/types";

const LABELS: Record<TradeStatus, string> = {
  planned: "Planned",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};
const TONES: Record<TradeStatus, BadgeTone> = {
  planned: "neutral",
  open: "gain",
  closed: "neutral",
  cancelled: "faint",
};

export function TradeStatusBadge({ status }: { status: TradeStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}

export function tradeStatusLabel(status: TradeStatus): string {
  return LABELS[status];
}
