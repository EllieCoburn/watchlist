import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TradeScenarioRow } from "@/lib/supabase/types";

export type Scenario = {
  id: string;
  ticker: string;
  entryPrice: number;
  capital: number;
  shares: number;
  targetPrice: number | null;
  stopPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

function num(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toScenario(row: TradeScenarioRow): Scenario {
  return {
    id: row.id,
    ticker: row.ticker,
    entryPrice: num(row.entry_price) ?? 0,
    capital: num(row.capital) ?? 0,
    shares: num(row.shares) ?? 0,
    targetPrice: num(row.target_price),
    stopPrice: num(row.stop_price),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getScenarios(userId: string): Promise<Scenario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trade_scenarios")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load scenarios: ${error.message}`);
  return (data ?? []).map(toScenario);
}

export async function getScenario(userId: string, id: string): Promise<Scenario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trade_scenarios")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load scenario: ${error.message}`);
  return data ? toScenario(data) : null;
}
