import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MarketStatus } from "@/components/watch";

export const metadata: Metadata = { title: "Watch" };

export default function WatchPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Watch"
        status={<MarketStatus status={{ isOpen: false, label: "Market closed" }} />}
      />
      <EmptyState
        title="Your watchlist is on its way."
        description="Stock cards, live quotes and multiple watchlists arrive in the next phase. This page is protected and ready for them."
      />
    </div>
  );
}
