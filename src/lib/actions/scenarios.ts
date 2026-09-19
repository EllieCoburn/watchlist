"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roundTo } from "@/lib/finance/money";
import { lookupSymbol } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import { parseOptionalPositiveNumber, parsePositiveNumber } from "@/lib/validation/numbers";

export type ScenarioActionState = { error?: string; ok?: true; id?: string };

const SIMULATE_PATH = "/app/simulate";

type ParsedScenario = {
  ticker: string;
  entryPrice: number;
  capital: number;
  shares: number;
  targetPrice: number | null;
  stopPrice: number | null;
  note: string | null;
};

function parseScenario(formData: FormData): { data?: ParsedScenario; error?: string } {
  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  const entryPrice = parsePositiveNumber(formData.get("entryPrice"));
  const shares = parsePositiveNumber(formData.get("shares"));
  const capital = parsePositiveNumber(formData.get("capital"));
  const target = parseOptionalPositiveNumber(formData.get("targetPrice"));
  const stop = parseOptionalPositiveNumber(formData.get("stopPrice"));
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 500) : null;

  if (!ticker) return { error: "Enter a ticker like PLTR." };
  if (!entryPrice) return { error: "Enter the current stock price." };
  if (!shares || !capital) return { error: "Enter an investment amount or a number of shares." };
  if (target.invalid || stop.invalid)
    return { error: "Target and stop prices must be positive numbers." };

  return {
    data: {
      ticker,
      entryPrice: roundTo(entryPrice, 4),
      capital: roundTo(capital, 2),
      shares: roundTo(shares, 4),
      targetPrice: target.value == null ? null : roundTo(target.value, 4),
      stopPrice: stop.value == null ? null : roundTo(stop.value, 4),
      note,
    },
  };
}

export async function saveScenario(
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const parsed = parseScenario(formData);
  if (!parsed.data) return { error: parsed.error };
  const s = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trade_scenarios")
    .insert({
      user_id: user.id,
      ticker: s.ticker,
      entry_price: String(s.entryPrice),
      capital: String(s.capital),
      shares: String(s.shares),
      target_price: s.targetPrice == null ? null : String(s.targetPrice),
      stop_price: s.stopPrice == null ? null : String(s.stopPrice),
      note: s.note,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      error: describeDbError(
        "Could not save the scenario",
        error ?? { message: "no row returned" },
      ),
    };

  revalidatePath(SIMULATE_PATH);
  return { ok: true, id: data.id };
}

export async function deleteScenario(id: string): Promise<ScenarioActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trade_scenarios")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: describeDbError("Could not delete the scenario", error) };

  revalidatePath(SIMULATE_PATH);
  return { ok: true };
}

/** Creates a planned trade from the simulator's current numbers and opens it. */
export async function convertScenarioToTrade(
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const parsed = parseScenario(formData);
  if (!parsed.data) return { error: parsed.error };
  const s = parsed.data;
  const scenarioIdRaw = formData.get("scenarioId");
  const scenarioId = typeof scenarioIdRaw === "string" && scenarioIdRaw ? scenarioIdRaw : null;

  const match = await lookupSymbol(s.ticker);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      ticker: s.ticker,
      company_name: match?.companyName ?? null,
      status: "planned",
      entry_price: String(s.entryPrice),
      shares: String(s.shares),
      capital: String(s.capital),
      target_price: s.targetPrice == null ? null : String(s.targetPrice),
      stop_price: s.stopPrice == null ? null : String(s.stopPrice),
      notes: s.note,
      scenario_id: scenarioId,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      error: describeDbError(
        "Could not create the planned trade",
        error ?? { message: "no row returned" },
      ),
    };

  revalidatePath("/app/trades");
  redirect(`/app/trades/${data.id}`);
}
