import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PricePoint, Quote } from "@/lib/market-data/types";
import type { PriceHistoryStore } from "@/lib/market-data/provider";

const MINUTE_MS = 60_000;
let warnedMissingTable = false;

/** Supabase-backed store of recorded quotes. Failures are logged once and never block a page. */
export function supabaseHistoryStore(): PriceHistoryStore {
  return {
    async recordTicks(quotes: Quote[]): Promise<void> {
      if (quotes.length === 0) return;
      const now = Date.now();
      // One tick per symbol per minute keeps the table small and de-duplicates polls.
      const minute = new Date(Math.floor(now / MINUTE_MS) * MINUTE_MS).toISOString();
      const rows = quotes.map((q) => ({ symbol: q.symbol, t: minute, price: String(q.price) }));
      try {
        const supabase = await createClient();
        const { error } = await supabase
          .from("price_ticks")
          .upsert(rows, { onConflict: "symbol,t", ignoreDuplicates: true });
        if (error && !warnedMissingTable) {
          warnedMissingTable = true;
          console.warn(
            "[price-ticks] could not record quotes:",
            error.message,
            "(run supabase/migrations/0003_price_ticks.sql)",
          );
        }
      } catch (err) {
        if (!warnedMissingTable) {
          warnedMissingTable = true;
          console.warn(
            "[price-ticks] could not record quotes:",
            err instanceof Error ? err.message : err,
          );
        }
      }
    },

    async getTicks(symbol: string, fromMs: number, toMs: number): Promise<PricePoint[]> {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("price_ticks")
          .select("t, price")
          .eq("symbol", symbol.toUpperCase())
          .gte("t", new Date(fromMs).toISOString())
          .lte("t", new Date(toMs).toISOString())
          .order("t", { ascending: true })
          .limit(2000);
        if (error || !data) return [];
        return data
          .map((r) => ({ t: Date.parse(r.t), price: Number(r.price) }))
          .filter((p) => p.price > 0);
      } catch {
        return [];
      }
    },
  };
}
