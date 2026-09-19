import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TradeForm } from "@/components/trades/trade-form";
import { getTrade } from "@/lib/data/trades";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit trade" };

export default async function EditTradePage({ params }: PageProps<"/app/trades/[id]/edit">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/trades");
  const { id } = await params;
  const trade = await getTrade(user.id, id);
  if (!trade) notFound();

  return (
    <div className="space-y-10">
      <PageHeader title={`Edit ${trade.ticker}`} status={<p className="label-caps">Journal</p>} />
      <div className="max-w-4xl">
        <TradeForm trade={trade} />
      </div>
    </div>
  );
}
