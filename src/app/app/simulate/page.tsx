import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import { SavedScenarios } from "@/components/simulate/saved-scenarios";
import { TradeSimulator } from "@/components/simulate/trade-simulator";
import type { SimulatorFormValues } from "@/components/simulate/simulator-form";
import { getScenario, getScenarios, type Scenario } from "@/lib/data/scenarios";
import { getQuote } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulate" };

export default async function SimulatePage({ searchParams }: PageProps<"/app/simulate">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/simulate");

  const params = await searchParams;
  const scenarioId = typeof params.scenario === "string" ? params.scenario : null;
  const ticker = typeof params.ticker === "string" ? normalizeTicker(params.ticker) : null;

  let scenarios: Scenario[] = [];
  let loadError: string | null = null;
  let initialValues: Partial<SimulatorFormValues> | undefined;

  try {
    scenarios = await getScenarios(user.id);
    if (scenarioId) {
      const s = await getScenario(user.id, scenarioId);
      if (s) {
        initialValues = {
          ticker: s.ticker,
          entryPrice: s.entryPrice.toFixed(2),
          sizingMode: "amount",
          amount: s.capital.toFixed(2),
          shares: s.shares.toFixed(4),
          targetPrice: s.targetPrice?.toFixed(2) ?? "",
          stopPrice: s.stopPrice?.toFixed(2) ?? "",
        };
      }
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load saved scenarios.";
  }

  if (!initialValues && ticker) {
    const q = await getQuote(ticker);
    initialValues = {
      ticker,
      entryPrice: q.price.toFixed(2),
      amount: "",
      shares: "",
      targetPrice: "",
      stopPrice: "",
    };
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Simulate"
        status={<p className="label-caps">Hypothetical · not a prediction</p>}
      />
      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      <TradeSimulator
        key={scenarioId ?? ticker ?? "example"}
        initialValues={initialValues}
        scenarioId={scenarioId}
      />
      <SavedScenarios scenarios={scenarios} activeId={scenarioId} />
    </div>
  );
}
