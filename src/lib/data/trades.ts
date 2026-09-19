import "server-only";

import type { Trade } from "@/lib/finance/trades";
import { createClient } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/supabase/types";

function num(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hhmm(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    status: row.status,
    entryPrice: num(row.entry_price),
    entryDate: row.entry_date,
    entryTime: hhmm(row.entry_time),
    shares: num(row.shares),
    capital: num(row.capital),
    targetPrice: num(row.target_price),
    stopPrice: num(row.stop_price),
    exitPrice: num(row.exit_price),
    exitDate: row.exit_date,
    exitTime: hhmm(row.exit_time),
    notes: row.notes,
    entryReason: row.entry_reason,
    reflection: row.reflection,
    followedPlan: row.followed_plan,
    improvement: row.improvement,
    scenarioId: row.scenario_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All of a user's trades (bounded). Filtering and sorting happen in lib/finance/trades.ts. */
export async function getTrades(userId: string): Promise<Trade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Could not load trades: ${error.message}`);
  return (data ?? []).map(toTrade);
}

export async function getTrade(userId: string, id: string): Promise<Trade | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load trade: ${error.message}`);
  return data ? toTrade(data) : null;
}
