import { NextResponse, type NextRequest } from "next/server";
import {
  getDailyBars,
  getIntradayHistory,
  getNextEarningsDate,
  getQuote,
} from "@/lib/market-data/provider";
import { getMarketDataProvider } from "@/lib/market-data/providers";
import type { DailyBar, IntradayHistory } from "@/lib/market-data/types";
import { alignBenchmark } from "@/lib/quant/features";
import { runSimulation, type SimulationResult } from "@/lib/quant/engine";
import { explainSimulation } from "@/lib/quant/explain";
import { resolveReference } from "@/lib/quant/reference";
import { parseSimulationRequest } from "@/lib/quant/validate";
import { cached } from "@/lib/market-data/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export const DATA_UNAVAILABLE =
  "Unable to calculate probability because required market data is unavailable.";
const BENCHMARK = "QQQ";
const DAILY_SESSIONS = 300;
const INTRADAY_SESSIONS = 252;
const INTRADAY_INTERVAL = Math.max(
  1,
  Math.min(5, Number(process.env.INTRADAY_INTERVAL_MINUTES ?? 1) || 1),
);

export type SimulateResponse = {
  result: SimulationResult;
  explanation: ReturnType<typeof explainSimulation>;
  runId: string | null;
  dataNotes: string[];
  /** Set only in development when modeled data was used. Never present in production. */
  devModeledData?: true;
};

/**
 * POST /api/simulate — assembles real market data (quote, daily bars, intraday bars,
 * benchmark, earnings), runs the three engines plus the walk-forward backtest, stores the
 * run for audit, and returns the result with a template-based explanation.
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
  const dataNotes: string[] = [];
  let devModeled = false;

  // 1. Daily bars (required, must be real).
  let bars: DailyBar[];
  let source: string;
  try {
    const daily = await getDailyBars(input.ticker, DAILY_SESSIONS);
    if (daily.source === "modeled") {
      if (isProd) throw new Error("modeled data");
      devModeled = true;
    }
    bars = daily.bars;
    source = daily.source === "modeled" ? "modeled (development only)" : daily.source;
  } catch (err) {
    console.warn("[simulate] daily bars unavailable:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: DATA_UNAVAILABLE }, { status: 422 });
  }
  if (bars.length < 60)
    return NextResponse.json(
      {
        error: `${DATA_UNAVAILABLE} Only ${bars.length} sessions of history were returned; at least 60 are needed.`,
      },
      { status: 422 },
    );

  // 2. Intraday bars (optional but strongly preferred; never modeled in production).
  let intraday: IntradayHistory | null = null;
  try {
    const h = await getIntradayHistory(input.ticker, INTRADAY_SESSIONS, INTRADAY_INTERVAL);
    if (h.source === "modeled" && isProd) throw new Error("modeled intraday");
    intraday = h;
  } catch (err) {
    dataNotes.push(
      `Intraday (5-minute) bars are unavailable: ${err instanceof Error ? err.message : String(err)}. First-touch order inside a session is modeled, not observed, and analogs use daily bars.`,
    );
  }

  // 3. Benchmark daily bars (optional).
  let bench: DailyBar[] | null = null;
  try {
    const b = await getDailyBars(BENCHMARK, DAILY_SESSIONS);
    if (b.source !== "modeled" || !isProd) bench = b.bars;
  } catch (err) {
    dataNotes.push(
      `Benchmark ${BENCHMARK} history is unavailable (${err instanceof Error ? err.message : String(err)}); market-context features are switched off.`,
    );
  }

  // 4. Quote and reference price.
  const provider = getMarketDataProvider();
  let quoteAsOf: number | null = null;
  let reference;
  try {
    const q = await getQuote(input.ticker);
    quoteAsOf = q.asOf;
    reference = resolveReference(q, bars[bars.length - 1].close, Date.now());
  } catch {
    const lastClose = bars[bars.length - 1].close;
    reference = {
      price: lastClose,
      asOf: bars[bars.length - 1].t,
      kind: "last-close" as const,
      label: "Last close (live quote unavailable)",
      gapScale: 1,
    };
    dataNotes.push("Live quote unavailable; the last daily close is the reference price.");
  }

  const earningsDate = await getNextEarningsDate(input.ticker).catch(() => null);

  let result: SimulationResult;
  try {
    const window = {
      bars,
      intraday: intraday?.sessions ?? null,
      intervalMinutes: intraday?.intervalMinutes ?? INTRADAY_INTERVAL,
      bench: alignBenchmark(bars, bench),
      benchSymbol: bench ? BENCHMARK : null,
    };
    // Identical inputs on identical data give identical results (seeded), so cache for 10 minutes.
    const cacheKey = `simulate:${input.ticker}:${reference.price.toFixed(4)}:${input.entry}:${input.target}:${input.stop}:${JSON.stringify(input.horizon)}:${input.shares ?? ""}:${bars[bars.length - 1].t}:${intraday?.sessions.length ?? 0}`;
    result = await cached(cacheKey, 10 * 60_000, async () =>
      runSimulation(input, window, {
        dataSource: source,
        provider: provider.id,
        quoteAsOf,
        reference,
        earningsDate,
      }),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Simulation failed." },
      { status: 400 },
    );
  }
  if (!result.checks.passed) {
    console.error("[simulate] sanity checks failed:", result.checks.failures);
    return NextResponse.json(
      {
        error: `The simulation failed its automated consistency checks and was not returned: ${result.checks.failures[0]}`,
      },
      { status: 500 },
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
          paths: result.engines.monteCarlo.sampleSize,
          seed: String(result.provenance.Seed ?? ""),
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
    dataNotes,
    ...(devModeled ? { devModeledData: true as const } : {}),
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
