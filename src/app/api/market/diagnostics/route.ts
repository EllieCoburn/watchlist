import { NextResponse } from "next/server";
import { getMarketDataProvider } from "@/lib/market-data/providers";
import { fetchFreeHistory } from "@/lib/market-data/sources/history";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * GET /api/market/diagnostics — tests each part of the market-data pipeline and reports
 * what works. Requires a login. Never includes secrets.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getMarketDataProvider();
  const report: Record<string, unknown> = {
    configuredProvider: process.env.MARKET_DATA_PROVIDER ?? "(unset → mock)",
    activeProvider: provider.id,
    apiKeyPresent: Boolean(process.env.MARKET_DATA_API_KEY),
    dataLabel: provider.dataLabel,
    checkedAt: new Date().toISOString(),
  };

  const timed = async <T>(label: string, run: () => Promise<T>) => {
    const start = Date.now();
    try {
      const value = await run();
      report[label] = { ok: true, ms: Date.now() - start, value };
    } catch (err) {
      report[label] = {
        ok: false,
        ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };

  await timed("quote", async () => {
    const q = await provider.getQuote("AAPL");
    return {
      price: q.price,
      change: q.change,
      dayLow: q.dayLow,
      dayHigh: q.dayHigh,
      asOf: new Date(q.asOf).toISOString(),
    };
  });
  await timed("series1M", async () => {
    const s = await provider.getHistoricalPrices("AAPL", "1M");
    return {
      source: s.source,
      points: s.points.length,
      first: s.points[0],
      last: s.points[s.points.length - 1],
    };
  });
  await timed("freeHistory1M", async () => (await fetchFreeHistory("AAPL", "1M")).attempts);
  await timed("freeHistory1D", async () => (await fetchFreeHistory("AAPL", "1D")).attempts);
  await timed("priceTicksTable", async () => {
    if (!user) return "skipped (not logged in)";
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("price_ticks")
      .select("symbol", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { rows: count };
  });

  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
