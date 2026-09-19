import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Trades" };

export default function TradesPage() {
  return (
    <div className="space-y-10">
      <PageHeader title="Trades" status={<p className="label-caps">Journal</p>} />
      <EmptyState
        title="No trades yet."
        description="Your journal will hold planned, open and closed trades with notes and reflections. Logging arrives in a later phase."
      />
    </div>
  );
}
