import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getTrades } from "@/lib/data/trades";
import type { Trade } from "@/lib/finance/trades";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/analytics");

  let trades: Trade[] = [];
  let loadError: string | null = null;
  try {
    trades = await getTrades(user.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load trades.";
  }
  const closed = trades.filter((t) => t.status === "closed").length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics"
        status={
          <p className="label-caps">
            Realized performance · {closed} closed {closed === 1 ? "trade" : "trades"}
          </p>
        }
      />
      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      {closed === 0 && !loadError ? (
        <EmptyState
          title="Nothing to analyze yet."
          description="Once you close a trade in your journal, this page shows your win rate, average winner and loser, and expectancy in plain language."
          action={<ButtonLink href="/app/trades/new">Log a trade</ButtonLink>}
        />
      ) : (
        <AnalyticsDashboard trades={trades} />
      )}
    </div>
  );
}
