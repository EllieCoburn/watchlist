import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TradeForm } from "@/components/trades/trade-form";
import { getQuote } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log trade" };

export default async function NewTradePage({ searchParams }: PageProps<"/app/trades/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/trades/new");

  const params = await searchParams;
  const ticker = typeof params.ticker === "string" ? normalizeTicker(params.ticker) : null;
  const defaults = ticker
    ? await getQuote(ticker).then((q) => ({
        ticker,
        companyName: q.companyName,
        entryPrice: q.price,
      }))
    : undefined;

  return (
    <div className="space-y-10">
      <PageHeader title="Log trade" status={<p className="label-caps">Journal</p>} />
      <div className="max-w-4xl">
        <TradeForm defaults={defaults} />
      </div>
    </div>
  );
}
