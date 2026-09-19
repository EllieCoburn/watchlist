import { cn } from "@/lib/utils";

export const DISCLAIMER_TEXT =
  "For informational and educational purposes only. Not investment advice.";

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted", className)}>{DISCLAIMER_TEXT}</p>;
}
