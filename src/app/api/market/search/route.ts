import { NextResponse, type NextRequest } from "next/server";
import { searchSymbols } from "@/lib/market-data/provider";
import { getCurrentUser } from "@/lib/supabase/server";

/** GET /api/market/search?q=app — symbol suggestions for the add-ticker input. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 20);
  const matches = q.trim() ? await searchSymbols(q) : [];
  return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
}
