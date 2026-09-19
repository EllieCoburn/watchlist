import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TradeSimulator } from "@/components/simulate/trade-simulator";

/** Development-only rendering of the simulator without a database. 404 in production. */
export default function SimulatePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="container-page space-y-12 py-10">
      <PageHeader
        title="Simulate"
        status={<p className="label-caps">Hypothetical · not a prediction</p>}
      />
      <TradeSimulator quoteEnabled={false} />
    </main>
  );
}
