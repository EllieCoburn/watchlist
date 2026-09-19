import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WatchlistItemRow, WatchlistRow } from "@/lib/supabase/types";

export type Watchlist = Pick<WatchlistRow, "id" | "name" | "position" | "created_at">;
export type WatchlistItem = Pick<
  WatchlistItemRow,
  "id" | "ticker" | "company_name" | "position" | "created_at"
>;

export async function getWatchlists(userId: string): Promise<Watchlist[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watchlists")
    .select("id, name, position, created_at")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load watchlists: ${error.message}`);
  return data ?? [];
}

export async function getWatchlistItems(watchlistId: string): Promise<WatchlistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("id, ticker, company_name, position, created_at")
    .eq("watchlist_id", watchlistId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load watchlist items: ${error.message}`);
  return data ?? [];
}
