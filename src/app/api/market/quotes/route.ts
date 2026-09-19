import { NextResponse, type NextRequest } from "next/server";
import { getWatchSnapshot } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { isTimeRange } from "@/lib/market-data/types";
import { getCurrentUser } from "@/lib/supabase/server";

const MAX_SYMBOLS = 60;

/**
 * GET /api/market/quotes?symbols=AAPL,NVDA&range=1D
 * Polled by the Watch dashboard. Runs server-side so provider keys stay private.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "1D";
  const range = isTimeRange(rangeParam) ? rangeParam : "1D";
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => normalizeTicker(s))
    .filter((s): s is string => Boolean(s))
    .slice(0, MAX_SYMBOLS);

  const snapshot = await getWatchSnapshot(symbols, range);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
