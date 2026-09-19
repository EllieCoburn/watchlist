import { notFound } from "next/navigation";
import { WatchDashboard } from "@/components/watch/watch-dashboard";
import type { Watchlist, WatchlistItem } from "@/lib/data/watchlists";
import { getWatchSnapshot } from "@/lib/market-data/provider";

/**
 * Development-only rendering of the Watch dashboard with in-memory data, so the layout can
 * be reviewed without a database. Returns 404 in production builds.
 */
export default async function WatchPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const now = new Date().toISOString();
  const watchlists: Watchlist[] = [
    { id: "preview-1", name: "Watchlist", position: 0, created_at: now },
  ];
  const items: WatchlistItem[] = [
    { id: "i1", ticker: "AAPL", company_name: "Apple Inc", position: 0, created_at: now },
    { id: "i2", ticker: "NVDA", company_name: "NVIDIA Corp", position: 1, created_at: now },
    { id: "i3", ticker: "MSFT", company_name: "Microsoft Corp", position: 2, created_at: now },
  ];
  const snapshot = await getWatchSnapshot(
    items.map((i) => i.ticker),
    "1D",
  );

  return (
    <main className="container-page py-10">
      <WatchDashboard
        watchlists={watchlists}
        active={watchlists[0]}
        items={items}
        initialSnapshot={snapshot}
        polling
      />
    </main>
  );
}
