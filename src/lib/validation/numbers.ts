/** Parses a form value as a positive finite number, or null. Accepts "1,000.50" and "$12". */
export function parsePositiveNumber(
  value: FormDataEntryValue | string | null | undefined,
): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Like parsePositiveNumber but treats empty input as "not provided" (null) and rejects ≤ 0. */
export function parseOptionalPositiveNumber(
  value: FormDataEntryValue | string | null | undefined,
): { value: number | null; invalid: boolean } {
  if (typeof value !== "string" || value.trim() === "") return { value: null, invalid: false };
  const n = parsePositiveNumber(value);
  return n === null ? { value: null, invalid: true } : { value: n, invalid: false };
}
