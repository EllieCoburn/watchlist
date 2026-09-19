"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lookupSymbol } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type ActionResult = { error?: string; ok?: true };

const WATCH_PATH = "/app/watch";

function cleanName(value: FormDataEntryValue | null): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length === 0 || name.length > 60) return null;
  return name;
}

export async function createWatchlist(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Give the watchlist a name (up to 60 characters)." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("watchlists")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { data, error } = await supabase
    .from("watchlists")
    .insert({ user_id: user.id, name, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the watchlist. Please try again." };

  revalidatePath(WATCH_PATH);
  redirect(`${WATCH_PATH}?list=${data.id}`);
}

export async function renameWatchlist(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const id = String(formData.get("id") ?? "");
  const name = cleanName(formData.get("name"));
  if (!id) return { error: "Missing watchlist." };
  if (!name) return { error: "Give the watchlist a name (up to 60 characters)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watchlists")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not rename the watchlist." };

  revalidatePath(WATCH_PATH);
  return { ok: true };
}

export async function deleteWatchlist(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };

  const supabase = await createClient();
  const { error } = await supabase.from("watchlists").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete the watchlist." };

  revalidatePath(WATCH_PATH);
  redirect(WATCH_PATH);
}

export async function addTicker(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const watchlistId = String(formData.get("watchlistId") ?? "");
  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  if (!watchlistId) return { error: "Missing watchlist." };
  if (!ticker) return { error: "Enter a ticker like AAPL (letters, up to 10 characters)." };

  const match = await lookupSymbol(ticker);
  const supabase = await createClient();
  const { count } = await supabase
    .from("watchlist_items")
    .select("id", { count: "exact", head: true })
    .eq("watchlist_id", watchlistId);

  const { error } = await supabase.from("watchlist_items").insert({
    watchlist_id: watchlistId,
    user_id: user.id,
    ticker,
    company_name: match?.companyName ?? null,
    position: count ?? 0,
  });
  if (error) {
    if (error.code === "23505") return { error: `${ticker} is already on this watchlist.` };
    return { error: "Could not add the ticker. Please try again." };
  }

  revalidatePath(WATCH_PATH);
  return { ok: true };
}

export async function removeTicker(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { error: "Could not remove the ticker." };

  revalidatePath(WATCH_PATH);
  return { ok: true };
}
