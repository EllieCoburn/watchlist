import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import { WatchDashboard } from "@/components/watch/watch-dashboard";
import {
  getWatchlistItems,
  getWatchlists,
  type Watchlist,
  type WatchlistItem,
} from "@/lib/data/watchlists";
import { getWatchSnapshot } from "@/lib/market-data/provider";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Watch" };

export default async function WatchPage({ searchParams }: PageProps<"/app/watch">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/watch");

  const params = await searchParams;
  const requestedList = typeof params.list === "string" ? params.list : null;

  let watchlists: Watchlist[] = [];
  let items: WatchlistItem[] = [];
  let loadError: string | null = null;
  let active: Watchlist | null = null;

  try {
    watchlists = await getWatchlists(user.id);
    active = watchlists.find((w) => w.id === requestedList) ?? watchlists[0] ?? null;
    if (active) items = await getWatchlistItems(active.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load your watchlists.";
  }

  if (loadError) {
    return (
      <div className="space-y-10">
        <PageHeader title="Watch" />
        <Notice tone="error">
          {loadError} Check that the database migrations have been applied and that Supabase is
          reachable.
        </Notice>
      </div>
    );
  }

  const snapshot = await getWatchSnapshot(
    items.map((i) => i.ticker),
    "1D",
  );

  return (
    <WatchDashboard
      watchlists={watchlists}
      active={active}
      items={items}
      initialSnapshot={snapshot}
    />
  );
}
