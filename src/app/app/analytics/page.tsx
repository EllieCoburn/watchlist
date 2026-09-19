import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="space-y-10">
      <PageHeader title="Analytics" status={<p className="label-caps">Realized performance</p>} />
      <EmptyState
        title="Nothing to analyze yet."
        description="Once you have closed trades in your journal, this page will show win rate, average winner and loser, and expectancy in plain language."
      />
    </div>
  );
}
