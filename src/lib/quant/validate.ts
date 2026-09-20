import { normalizeTicker } from "@/lib/market-data/symbols";
import { MAX_CUSTOM_DAYS, type HorizonInput } from "./calendar";
import type { SimulationInput } from "./engine";

export type SimulationRequest = {
  ticker: string;
  entry: number;
  target: number;
  stop: number;
  horizon: { type: "today" | "next" | "custom"; days?: number };
  shares?: number | null;
};

/** Validates an untrusted request body into engine input, or returns a message for the user. */
export function parseSimulationRequest(body: unknown): { input?: SimulationInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Missing request body." };
  const b = body as Record<string, unknown>;
  const ticker = normalizeTicker(String(b.ticker ?? ""));
  if (!ticker) return { error: "Enter a ticker like KTOS." };
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? v
      : typeof v === "string"
        ? Number(v.replace(/[$,\s]/g, ""))
        : NaN;
  const entry = num(b.entry);
  const target = num(b.target);
  const stop = num(b.stop);
  if (!(entry > 0)) return { error: "Enter the entry price." };
  if (!(target > 0)) return { error: "Enter a profit target." };
  if (!(stop > 0)) return { error: "Enter a stop-loss price." };
  if (!(target > entry)) return { error: "The profit target must be above the entry price." };
  if (!(stop < entry)) return { error: "The stop-loss must be below the entry price." };

  const h = (b.horizon ?? {}) as Record<string, unknown>;
  let horizon: HorizonInput;
  if (h.type === "today") horizon = { type: "today" };
  else if (h.type === "next") horizon = { type: "next" };
  else if (h.type === "custom") {
    const days = Math.floor(num(h.days));
    if (!(days >= 1 && days <= MAX_CUSTOM_DAYS))
      return { error: `Choose between 1 and ${MAX_CUSTOM_DAYS} trading days.` };
    horizon = { type: "custom", days };
  } else return { error: "Choose a time horizon." };

  const sharesRaw = b.shares == null || b.shares === "" ? null : num(b.shares);
  if (sharesRaw != null && !(sharesRaw > 0)) return { error: "Shares must be above zero." };

  return { input: { ticker, entry, target, stop, horizon, shares: sharesRaw } };
}
