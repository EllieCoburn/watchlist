"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roundTo } from "@/lib/finance/money";
import { lookupSymbol } from "@/lib/market-data/provider";
import { normalizeTicker } from "@/lib/market-data/symbols";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Database, TradeStatus } from "@/lib/supabase/types";
import { parseOptionalPositiveNumber } from "@/lib/validation/numbers";

export type TradeFormState = {
  error?: string;
  fieldErrors?: Partial<Record<TradeField, string>>;
};

export type TradeField =
  | "ticker"
  | "status"
  | "entryPrice"
  | "entryDate"
  | "entryTime"
  | "shares"
  | "capital"
  | "targetPrice"
  | "stopPrice"
  | "exitPrice"
  | "exitDate"
  | "exitTime";

const STATUSES: TradeStatus[] = ["planned", "open", "closed", "cancelled"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

type TradeInsert = Database["public"]["Tables"]["trades"]["Insert"];

function text(formData: FormData, key: string, max = 2000): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function dateField(formData: FormData, key: string): { value: string | null; invalid: boolean } {
  const v = text(formData, key, 10);
  if (!v) return { value: null, invalid: false };
  return DATE_RE.test(v) ? { value: v, invalid: false } : { value: null, invalid: true };
}

function timeField(formData: FormData, key: string): { value: string | null; invalid: boolean } {
  const v = text(formData, key, 8);
  if (!v) return { value: null, invalid: false };
  return TIME_RE.test(v) ? { value: v, invalid: false } : { value: null, invalid: true };
}

function moneyString(n: number | null, decimals: number): string | null {
  return n == null ? null : String(roundTo(n, decimals));
}

async function parseTrade(
  formData: FormData,
  userId: string,
): Promise<{
  data?: Omit<TradeInsert, "id" | "created_at" | "updated_at">;
  state?: TradeFormState;
}> {
  const fieldErrors: TradeFormState["fieldErrors"] = {};

  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  if (!ticker) fieldErrors.ticker = "Enter a ticker like AAPL.";

  const statusRaw = String(formData.get("status") ?? "planned");
  const status = STATUSES.includes(statusRaw as TradeStatus) ? (statusRaw as TradeStatus) : null;
  if (!status) fieldErrors.status = "Choose a status.";

  const entryPrice = parseOptionalPositiveNumber(formData.get("entryPrice"));
  const shares = parseOptionalPositiveNumber(formData.get("shares"));
  const capital = parseOptionalPositiveNumber(formData.get("capital"));
  const targetPrice = parseOptionalPositiveNumber(formData.get("targetPrice"));
  const stopPrice = parseOptionalPositiveNumber(formData.get("stopPrice"));
  const exitPrice = parseOptionalPositiveNumber(formData.get("exitPrice"));
  const entryDate = dateField(formData, "entryDate");
  const entryTime = timeField(formData, "entryTime");
  const exitDate = dateField(formData, "exitDate");
  const exitTime = timeField(formData, "exitTime");

  if (entryPrice.invalid) fieldErrors.entryPrice = "Enter a price above zero.";
  if (shares.invalid) fieldErrors.shares = "Enter a number above zero.";
  if (capital.invalid) fieldErrors.capital = "Enter an amount above zero.";
  if (targetPrice.invalid) fieldErrors.targetPrice = "Enter a price above zero.";
  if (stopPrice.invalid) fieldErrors.stopPrice = "Enter a price above zero.";
  if (exitPrice.invalid) fieldErrors.exitPrice = "Enter a price above zero.";
  if (entryDate.invalid) fieldErrors.entryDate = "Use a valid date.";
  if (entryTime.invalid) fieldErrors.entryTime = "Use a valid time.";
  if (exitDate.invalid) fieldErrors.exitDate = "Use a valid date.";
  if (exitTime.invalid) fieldErrors.exitTime = "Use a valid time.";

  if (status === "open" || status === "closed") {
    if (!entryPrice.value) fieldErrors.entryPrice ??= "Needed for an open or closed trade.";
    if (!shares.value) fieldErrors.shares ??= "Needed for an open or closed trade.";
  }
  if (status === "closed") {
    if (!exitPrice.value) fieldErrors.exitPrice ??= "Needed to close the trade.";
  }
  if (entryDate.value && exitDate.value && exitDate.value < entryDate.value) {
    fieldErrors.exitDate = "Exit cannot be before entry.";
  }

  if (Object.keys(fieldErrors).length > 0) return { state: { fieldErrors } };

  const companyFromForm = text(formData, "companyName", 120);
  const match = companyFromForm ? null : await lookupSymbol(ticker!);

  return {
    data: {
      user_id: userId,
      ticker: ticker!,
      company_name: companyFromForm ?? match?.companyName ?? null,
      status: status!,
      entry_price: moneyString(entryPrice.value, 4),
      entry_date: entryDate.value,
      entry_time: entryTime.value,
      shares: moneyString(shares.value, 4),
      capital: moneyString(capital.value, 2),
      target_price: moneyString(targetPrice.value, 4),
      stop_price: moneyString(stopPrice.value, 4),
      exit_price: moneyString(exitPrice.value, 4),
      exit_date: exitDate.value,
      exit_time: exitTime.value,
      notes: text(formData, "notes"),
      entry_reason: text(formData, "entryReason"),
      reflection: text(formData, "reflection"),
      followed_plan: parseFollowedPlan(formData.get("followedPlan")),
      improvement: text(formData, "improvement"),
    },
  };
}

function parseFollowedPlan(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export async function createTrade(
  _prev: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const parsed = await parseTrade(formData, user.id);
  if (!parsed.data) return parsed.state ?? { error: "Check the form." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("trades").insert(parsed.data).select("id").single();
  if (error || !data) return { error: "Could not save the trade. Please try again." };

  revalidatePath("/app/trades");
  revalidatePath("/app/analytics");
  redirect(`/app/trades/${data.id}`);
}

export async function updateTrade(
  _prev: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing trade." };
  const parsed = await parseTrade(formData, user.id);
  if (!parsed.data) return parsed.state ?? { error: "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trades")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not save the trade. Please try again." };

  revalidatePath("/app/trades");
  revalidatePath(`/app/trades/${id}`);
  revalidatePath("/app/analytics");
  redirect(`/app/trades/${id}`);
}

export async function deleteTrade(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };

  const supabase = await createClient();
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete the trade." };

  revalidatePath("/app/trades");
  revalidatePath("/app/analytics");
  redirect("/app/trades");
}
