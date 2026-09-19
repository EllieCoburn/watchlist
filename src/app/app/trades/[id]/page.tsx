import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteTradeButton } from "@/components/trades/delete-trade-button";
import { TradeDetail } from "@/components/trades/trade-detail";
import { ButtonLink } from "@/components/ui/button";
import { getTrade } from "@/lib/data/trades";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trade" };

export default async function TradePage({ params }: PageProps<"/app/trades/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/trades");
  const { id } = await params;
  const trade = await getTrade(user.id, id);
  if (!trade) notFound();

  return (
    <div className="space-y-10">
      <PageHeader
        title={trade.ticker}
        status={
          <p className="label-caps">
            <Link href="/app/trades" className="underline-offset-4 hover:text-ink hover:underline">
              Trades
            </Link>{" "}
            · {trade.companyName ?? "Trade"}
          </p>
        }
        aside={
          <div className="flex items-center gap-4">
            <DeleteTradeButton id={trade.id} ticker={trade.ticker} />
            <ButtonLink href={`/app/trades/${trade.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          </div>
        }
      />
      <TradeDetail trade={trade} />
    </div>
  );
}
