"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import type { Watchlist, WatchlistItem } from "@/lib/data/watchlists";
import type { WatchSnapshot } from "@/lib/market-data/provider";
import { rangeCaption } from "@/lib/market-data/range-stats";
import { formatPrice } from "@/lib/finance/money";
import { AddTickerSlot } from "./add-ticker-slot";
import { LiveClock } from "./live-clock";
import { MarketStatus } from "./market-status";
import { RemoveTickerButton } from "./remove-ticker-button";
import { StockCard, type StockCardData } from "./stock-card";
import { TimeRangeSelector, type TimeRange } from "./time-range-selector";
import { NewWatchlistButton, WatchlistManage, WatchlistTabs } from "./watchlist-switcher";

export const POLL_INTERVAL_MS = 10_000;
const COLUMNS = 3;

type WatchDashboardProps = {
  watchlists: Watchlist[];
  active: Watchlist | null;
  items: WatchlistItem[];
  initialSnapshot: WatchSnapshot;
  /** Disable network polling (dev preview). */
  polling?: boolean;
};

export function WatchDashboard({
  watchlists,
  active,
  items,
  initialSnapshot,
  polling = true,
}: WatchDashboardProps) {
  const [range, setRange] = useState<TimeRange>("1D");
  const [snapshot, setSnapshot] = useState<WatchSnapshot>(initialSnapshot);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [extraRows, setExtraRows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // After a mutation the server re-renders with fresh props; adopt them (state adjustment during render).
  const [adoptedSnapshot, setAdoptedSnapshot] = useState(initialSnapshot);
  if (initialSnapshot !== adoptedSnapshot) {
    setAdoptedSnapshot(initialSnapshot);
    setSnapshot(initialSnapshot);
    setRemovedIds(new Set());
  }

  const visibleItems = useMemo(
    () => items.filter((i) => !removedIds.has(i.id)),
    [items, removedIds],
  );
  const symbolsKey = visibleItems.map((i) => i.ticker).join(",");

  // Poll every 10s while the tab is visible; refetch immediately when symbols or range change.
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let timer: number | undefined;

    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/market/quotes?symbols=${encodeURIComponent(symbolsKey)}&range=${range}`,
          {
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(`Quote request failed (${res.status})`);
        const data = (await res.json()) as WatchSnapshot;
        if (cancelled) return;
        setSnapshot(data);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      }
    };

    void refresh();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [polling, symbolsKey, range]);

  const filledRows = Math.max(1, Math.ceil(visibleItems.length / COLUMNS));
  const slotCount = (filledRows + extraRows) * COLUMNS;
  const emptySlots = Math.max(0, slotCount - visibleItems.length);

  // Figures follow the selected range; symbols without real history for it fall back to today.
  const caption = rangeCaption(range);
  const todayOnly = snapshot.todayOnly.filter((s) => visibleItems.some((i) => i.ticker === s));
  const rangeNote =
    todayOnly.length > 0
      ? `Real ${caption} history is still building for ${todayOnly.join(", ")}: showing today's change and low/high with a modeled sparkline.`
      : null;

  const cards: StockCardData[] = visibleItems.map((item) => {
    const q = snapshot.quotes[item.ticker];
    const stats = snapshot.rangeStats[item.ticker];
    return {
      ticker: item.ticker,
      companyName: item.company_name ?? q?.companyName ?? "—",
      price: q?.price ?? 0,
      change: stats?.change ?? q?.change ?? 0,
      changePercent: stats?.changePercent ?? q?.changePercent ?? 0,
      low: stats?.low ?? q?.dayLow ?? 0,
      high: stats?.high ?? q?.dayHigh ?? 0,
      sparkline: snapshot.series[item.ticker] ?? [],
    };
  });

  const trackedLabel = `${visibleItems.length} tracked`;
  const listLabel = `${watchlists.length} ${watchlists.length === 1 ? "watchlist" : "watchlists"}`;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Watch"
        status={
          <MarketStatus status={{ isOpen: snapshot.status.isOpen, label: snapshot.status.label }} />
        }
        aside={
          <>
            <TimeRangeSelector value={range} onChange={setRange} />
            <p className="font-mono text-sm text-muted" aria-live="polite">
              {stale ? "reconnecting" : `polling every ${POLL_INTERVAL_MS / 1000}s`} ·{" "}
              {snapshot.dataLabel}
            </p>
          </>
        }
      />

      {error ? (
        <Notice tone="error">
          {error}{" "}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </Notice>
      ) : null}

      {rangeNote ? (
        <p className="font-mono text-xs text-muted" role="status">
          {rangeNote}
        </p>
      ) : null}

      <WatchlistTabs watchlists={watchlists} activeId={active?.id ?? null} />

      {active ? (
        <section aria-labelledby="watchlist-heading" className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <h2 id="watchlist-heading" className="font-serif text-3xl leading-none text-ink">
                {active.name}
              </h2>
              <WatchlistManage watchlist={active} />
            </div>
            <p className="tabular font-mono text-sm text-muted">
              {visibleItems.length} of {slotCount}
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {cards.map((card, index) => (
              <li key={visibleItems[index].id}>
                <StockCard
                  data={card}
                  rangeLabel={caption}
                  remove={
                    <RemoveTickerButton
                      itemId={visibleItems[index].id}
                      ticker={card.ticker}
                      onRemoved={(id) => setRemovedIds((prev) => new Set(prev).add(id))}
                      onError={(message) => {
                        setError(message);
                        setRemovedIds(new Set());
                      }}
                    />
                  }
                />
              </li>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <li key={`empty-${i}`}>
                <AddTickerSlot watchlistId={active.id} primary={i === 0} />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setExtraRows((n) => n + 1)}
            className="label-caps flex items-center gap-2 text-muted transition-colors duration-150 hover:text-ink"
          >
            <span aria-hidden="true">+</span> Add a line of three
          </button>
        </section>
      ) : (
        <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">
          You have no watchlists yet. Create one to start tracking tickers.
        </p>
      )}

      <div className="pt-2">
        <NewWatchlistButton />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 font-mono text-sm text-muted">
        <p>
          {listLabel} · {trackedLabel} · {caption} change, high &amp; low
          {cards.length > 0 && snapshot.quotes[cards[0].ticker] ? (
            <span className="sr-only">
              . Prices as of {formatPrice(snapshot.asOf / 1000)} seconds.
            </span>
          ) : null}
        </p>
        <LiveClock className="tabular" />
      </footer>
    </div>
  );
}
