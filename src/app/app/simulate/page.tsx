import type { Metadata } from "next";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Simulate" };

export default function SimulatePage() {
  return (
    <div className="space-y-10">
      <PageHeader title="Simulate" status={<p className="label-caps">Hypothetical scenarios</p>} />
      <EmptyState
        title="The trade simulator is coming next."
        description="Enter a price, an amount, a target and a stop to see the potential outcome before any money moves."
      />
    </div>
  );
}
