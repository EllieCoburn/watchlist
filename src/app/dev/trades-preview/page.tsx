import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TradeDetail } from "@/components/trades/trade-detail";
import { TradeFilters } from "@/components/trades/trade-filters";
import { TradeForm } from "@/components/trades/trade-form";
import { TradeList } from "@/components/trades/trade-list";
import type { Trade } from "@/lib/finance/trades";

const base: Trade = {
  id: "p1",
  ticker: "PLTR",
  companyName: "Palantir Technologies",
  status: "closed",
  entryPrice: 175,
  entryDate: "2026-09-01",
  entryTime: "09:45",
  shares: 57.1429,
  capital: 10_000,
  targetPrice: 177,
  stopPrice: 174,
  exitPrice: 177.4,
  exitDate: "2026-09-03",
  exitTime: "15:30",
  notes: "Breakout above the prior week's range on higher volume.",
  entryReason: "Wanted to test a small, well-defined risk on a strong name.",
  reflection: "Reached the target in two days; sold a little above it.",
  followedPlan: true,
  improvement: "Could have scaled out instead of exiting all at once.",
  scenarioId: null,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-03T20:00:00Z",
};

const TRADES: Trade[] = [
  base,
  {
    ...base,
    id: "p2",
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    entryPrice: 228,
    exitPrice: 219.5,
    shares: 20,
    capital: 4560,
    targetPrice: 240,
    stopPrice: 220,
    exitDate: "2026-09-10",
    entryDate: "2026-09-08",
  },
  {
    ...base,
    id: "p3",
    ticker: "AAPL",
    companyName: "Apple Inc",
    status: "open",
    entryPrice: 331.2,
    exitPrice: null,
    exitDate: null,
    exitTime: null,
    shares: 15,
    capital: 4968,
    targetPrice: 345,
    stopPrice: 324,
    entryDate: "2026-09-15",
  },
  {
    ...base,
    id: "p4",
    ticker: "MSFT",
    companyName: "Microsoft Corp",
    status: "planned",
    entryPrice: 490,
    exitPrice: null,
    exitDate: null,
    entryDate: null,
    shares: 10,
    capital: 4900,
    targetPrice: 510,
    stopPrice: 480,
  },
];

/** Development-only rendering of the trade journal views with in-memory data. 404 in production. */
export default async function TradesPreviewPage({
  searchParams,
}: PageProps<"/dev/trades-preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "list";

  return (
    <main className="container-page space-y-10 py-10">
      {view === "detail" ? (
        <>
          <PageHeader
            title="PLTR"
            status={<p className="label-caps">Trades · Palantir Technologies</p>}
          />
          <TradeDetail trade={base} />
        </>
      ) : view === "form" ? (
        <>
          <PageHeader title="Log trade" status={<p className="label-caps">Journal</p>} />
          <div className="max-w-4xl">
            <TradeForm />
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title="Trades"
            status={<p className="label-caps">Journal · 4 trades · 1 open · 2 closed</p>}
          />
          <TradeFilters filter="all" sort="newest" search="" />
          <TradeList trades={TRADES} />
        </>
      )}
    </main>
  );
}
