export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: FormDataEntryValue | null): string | null {
  const email = typeof value === "string" ? value.trim() : "";
  return EMAIL_RE.test(email) ? email : null;
}

export function validatePassword(value: FormDataEntryValue | null): string | null {
  const password = typeof value === "string" ? value : "";
  return password.length >= MIN_PASSWORD_LENGTH ? password : null;
}

export function validateDisplayName(value: FormDataEntryValue | null): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length === 0) return "";
  return name.length <= 80 ? name : null;
}

/** Only allow same-origin relative paths as post-login destinations. */
export function safeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/app",
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
