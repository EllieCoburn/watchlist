import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TradeFilters } from "@/components/trades/trade-filters";
import { TradeList } from "@/components/trades/trade-list";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getTrades } from "@/lib/data/trades";
import {
  filterTrades,
  sortTrades,
  type Trade,
  type TradeFilter,
  type TradeSort,
} from "@/lib/finance/trades";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trades" };

const FILTERS: TradeFilter[] = ["all", "open", "closed", "planned"];
const SORTS: TradeSort[] = ["newest", "oldest", "largest-win", "largest-loss"];

export default async function TradesPage({ searchParams }: PageProps<"/app/trades">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/trades");

  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : "all";
  const filter: TradeFilter = FILTERS.includes(statusParam as TradeFilter)
    ? (statusParam as TradeFilter)
    : "all";
  const sortParam = typeof params.sort === "string" ? params.sort : "newest";
  const sort: TradeSort = SORTS.includes(sortParam as TradeSort)
    ? (sortParam as TradeSort)
    : "newest";
  const search = typeof params.q === "string" ? params.q : "";

  let trades: Trade[] = [];
  let loadError: string | null = null;
  try {
    trades = await getTrades(user.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load trades.";
  }

  const shown = sortTrades(filterTrades(trades, filter, search), sort);
  const closedCount = trades.filter((t) => t.status === "closed").length;
  const openCount = trades.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Trades"
        status={
          <p className="label-caps">
            Journal · {trades.length} {trades.length === 1 ? "trade" : "trades"} · {openCount} open
            · {closedCount} closed
          </p>
        }
        aside={<ButtonLink href="/app/trades/new">Log trade</ButtonLink>}
      />

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}

      {trades.length === 0 && !loadError ? (
        <EmptyState
          title="No trades yet."
          description="Log a trade you have made or are planning. Entry, exit and a few notes are enough to start learning from it."
          action={<ButtonLink href="/app/trades/new">Log your first trade</ButtonLink>}
        />
      ) : (
        <div className="space-y-6">
          <TradeFilters filter={filter} sort={sort} search={search} />
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No trades match these filters.</p>
          ) : (
            <TradeList trades={shown} />
          )}
        </div>
      )}
    </div>
  );
}
