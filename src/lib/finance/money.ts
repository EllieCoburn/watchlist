/**
 * Rounding and formatting helpers. All display values go through these so
 * floating-point artefacts (0.1 + 0.2) never reach the screen.
 */

const EPSILON = 1e-9;

/** Round to `decimals` places, nudging by a tiny epsilon so 1.005 → 1.01 rather than 1.00. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const nudged = value + Math.sign(value) * EPSILON;
  return Math.round(nudged * factor) / factor;
}

export function roundMoney(value: number): number {
  return roundTo(value, 2);
}

/** Normalises -0 to 0 so we never print "−0.00". */
function clean(value: number): number {
  const rounded = roundMoney(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Typographic minus sign, used instead of a hyphen for negative values. */
export const MINUS = "−";

function withSign(formatted: string, value: number, forcePlus: boolean): string {
  if (value < 0) return `${MINUS}${formatted}`;
  if (value > 0 && forcePlus) return `+${formatted}`;
  return formatted;
}

/** "$1,234.56" — never shows a leading minus with the currency symbol in the wrong place. */
export function formatMoney(value: number): string {
  const v = clean(value);
  return withSign(usd.format(Math.abs(v)), v, false);
}

/** "+$114.28" / "−$57.14" / "$0.00" */
export function formatSignedMoney(value: number): string {
  const v = clean(value);
  return withSign(usd.format(Math.abs(v)), v, true);
}

/** "336.13" — price without a currency symbol, as used on stock cards. */
export function formatPrice(value: number): string {
  const v = clean(value);
  return withSign(plain.format(Math.abs(v)), v, false);
}

/** "+2.92" / "−1.77" — change without a currency symbol. */
export function formatSignedNumber(value: number, decimals = 2): string {
  const v = roundTo(value, decimals);
  const cleaned = Object.is(v, -0) ? 0 : v;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(cleaned));
  return withSign(formatted, cleaned, true);
}

/** "+1.33%" / "−0.53%" / "0.00%". Input is a percentage (1.33), not a ratio. */
export function formatSignedPercent(value: number, decimals = 2): string {
  return `${formatSignedNumber(value, decimals)}%`;
}

/** "12.5%" without a forced sign. */
export function formatPercent(value: number, decimals = 1): string {
  const v = roundTo(value, decimals);
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Object.is(v, -0) ? 0 : v)}%`;
}

/** Shares: whole numbers stay whole, fractional shares show 2 decimals ("57.14"). */
export function formatShares(value: number): string {
  const v = roundTo(value, 4);
  if (Number.isInteger(v)) return new Intl.NumberFormat("en-US").format(v);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}
