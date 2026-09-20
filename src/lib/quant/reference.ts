import { getMarketStatusAt, latestSessionOpen, sessionClose } from "@/lib/market-data/market-hours";
import type { Quote } from "@/lib/market-data/types";

export type ReferenceKind = "last-close" | "premarket" | "intraday" | "after-hours";

export type ReferencePrice = {
  price: number;
  asOf: number;
  kind: ReferenceKind;
  /** Human label: "Weekend / pre-premarket estimate" or "Live premarket estimate" etc. */
  label: string;
  /**
   * Multiplier applied to the modeled overnight gap. 1 when the reference is the last
   * close; smaller when a live extended-hours price already absorbs part of the move.
   */
  gapScale: number;
};

/**
 * Decides where a simulation starts. Premarket and after-hours prices are used when the
 * quote is newer than the last regular close; otherwise the last close is the reference.
 */
export function resolveReference(
  quote: Quote,
  lastCloseFromBars: number | null,
  now: number,
): ReferencePrice {
  const status = getMarketStatusAt(now);
  const open = latestSessionOpen(now);
  const close = sessionClose(open);
  const lastClose = lastCloseFromBars ?? quote.previousClose;

  if (status.isOpen) {
    return {
      price: quote.price,
      asOf: quote.asOf,
      kind: "intraday",
      label: "Live intraday reference (current price)",
      gapScale: 0,
    };
  }
  // Extended hours: the quote's timestamp is after the last regular close.
  const quoteAfterClose = quote.asOf > close + 60_000;
  const quoteIsRecent = now - quote.asOf < 6 * 3_600_000; // a live extended-hours print, not a stale timestamp
  if (quoteAfterClose && quoteIsRecent) {
    const beforeNextOpen = now < close + 20 * 3_600_000;
    return {
      price: quote.price,
      asOf: quote.asOf,
      kind: beforeNextOpen ? "after-hours" : "premarket",
      label: beforeNextOpen ? "Live after-hours estimate" : "Live premarket estimate",
      gapScale: 0.5,
    };
  }
  return {
    price: lastClose > 0 ? lastClose : quote.price,
    asOf: close,
    kind: "last-close",
    label: "Weekend / pre-premarket estimate (from the last close)",
    gapScale: 1,
  };
}
