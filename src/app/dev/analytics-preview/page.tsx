import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import type { Trade } from "@/lib/finance/trades";

function t(o: Partial<Trade>): Trade {
  return {
    id: Math.random().toString(36).slice(2),
    ticker: "AAPL",
    companyName: "Apple Inc",
    status: "closed",
    entryPrice: 100,
    entryDate: "2026-08-01",
    entryTime: null,
    shares: 10,
    capital: 1000,
    targetPrice: 110,
    stopPrice: 95,
    exitPrice: 105,
    exitDate: "2026-08-05",
    exitTime: null,
    notes: null,
    entryReason: null,
    reflection: null,
    followedPlan: null,
    improvement: null,
    scenarioId: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
    ...o,
  };
}

const TRADES: Trade[] = [
  t({
    ticker: "PLTR",
    companyName: "Palantir Technologies",
    entryPrice: 175,
    exitPrice: 177.4,
    shares: 57.14,
    capital: 10000,
    targetPrice: 177,
    stopPrice: 174,
    exitDate: "2026-07-20",
  }),
  t({
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    entryPrice: 228,
    exitPrice: 219.5,
    shares: 20,
    capital: 4560,
    targetPrice: 240,
    stopPrice: 220,
    exitDate: "2026-07-28",
  }),
  t({
    ticker: "AAPL",
    entryPrice: 320,
    exitPrice: 331,
    shares: 15,
    capital: 4800,
    targetPrice: 335,
    stopPrice: 312,
    exitDate: "2026-08-04",
  }),
  t({
    ticker: "MSFT",
    companyName: "Microsoft Corp",
    entryPrice: 480,
    exitPrice: 468,
    shares: 8,
    capital: 3840,
    targetPrice: 500,
    stopPrice: 470,
    exitDate: "2026-08-12",
  }),
  t({
    ticker: "PLTR",
    companyName: "Palantir Technologies",
    entryPrice: 168,
    exitPrice: 181,
    shares: 40,
    capital: 6720,
    targetPrice: 180,
    stopPrice: 162,
    exitDate: "2026-08-19",
  }),
  t({
    ticker: "TSLA",
    companyName: "Tesla Inc",
    entryPrice: 400,
    exitPrice: 400,
    shares: 5,
    capital: 2000,
    targetPrice: 420,
    stopPrice: 390,
    exitDate: "2026-08-26",
  }),
  t({
    ticker: "AAPL",
    entryPrice: 328,
    exitPrice: 336,
    shares: 12,
    capital: 3936,
    targetPrice: 340,
    stopPrice: 322,
    exitDate: "2026-09-03",
  }),
  t({
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    entryPrice: 215,
    exitPrice: 226,
    shares: 25,
    capital: 5375,
    targetPrice: 230,
    stopPrice: 208,
    exitDate: "2026-09-11",
  }),
  t({
    ticker: "AMD",
    companyName: "Advanced Micro Devices",
    status: "open",
    exitPrice: null,
    exitDate: null,
    entryDate: "2026-09-15",
  }),
];

/** Development-only analytics rendering with in-memory trades. 404 in production. */
export default function AnalyticsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="container-page space-y-10 py-10">
      <PageHeader
        title="Analytics"
        status={<p className="label-caps">Realized performance · 8 closed trades</p>}
      />
      <AnalyticsDashboard trades={TRADES} />
    </main>
  );
}
