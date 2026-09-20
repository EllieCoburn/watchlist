import { NextResponse, type NextRequest } from "next/server";
import { getDailyBars, getNextEarningsDate } from "@/lib/market-data/provider";
import { runSimulation, type SimulationResult } from "@/lib/quant/engine";
import { explainSimulation } from "@/lib/quant/explain";
import { parseSimulationRequest } from "@/lib/quant/validate";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export const DATA_UNAVAILABLE =
  "Unable to calculate probability because required market data is unavailable.";

export type SimulateResponse = {
  result: SimulationResult;
  explanation: ReturnType<typeof explainSimulation>;
  runId: string | null;
  /** Set only in development when modeled bars were used. Never present in production. */
  devModeledData?: true;
};

/**
 * POST /api/simulate — runs the probability calculator server-side on real daily bars,
 * stores the run for audit, and returns the result plus a template-based explanation.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const isProd = process.env.NODE_ENV === "production";
  if (!user && isProd) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseSimulationRequest(body);
  if (!parsed.input) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.input;

  let bars;
  let source: string;
  let devModeled = false;
  try {
    const daily = await getDailyBars(input.ticker, 260);
    if (daily.source === "modeled") {
      if (isProd) throw new Error("modeled data");
      devModeled = true;
    }
    bars = daily.bars;
    source = daily.source;
  } catch (err) {
    console.warn("[simulate] daily bars unavailable:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: DATA_UNAVAILABLE }, { status: 422 });
  }

  const earningsDate = await getNextEarningsDate(input.ticker).catch(() => null);

  let result: SimulationResult;
  try {
    result = runSimulation(input, bars, { dataSource: source, earningsDate });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Simulation failed." },
      { status: 400 },
    );
  }
  const explanation = explainSimulation(result);

  let runId: string | null = null;
  if (user) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("simulation_runs")
        .insert({
          user_id: user.id,
          ticker: input.ticker,
          model_version: result.modelVersion,
          entry_price: String(input.entry),
          target_price: String(input.target),
          stop_price: String(input.stop),
          horizon: input.horizon,
          shares: input.shares == null ? null : String(input.shares),
          data_source: source,
          bars_used: bars.length,
          paths: result.monteCarlo.paths,
          seed: result.monteCarlo.seed,
          result,
        })
        .select("id")
        .single();
      if (error) console.warn("[simulate] could not store run:", error.message);
      else runId = data.id;
    } catch (err) {
      console.warn("[simulate] could not store run:", err instanceof Error ? err.message : err);
    }
  }

  const response: SimulateResponse = {
    result,
    explanation,
    runId,
    ...(devModeled ? { devModeledData: true as const } : {}),
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
