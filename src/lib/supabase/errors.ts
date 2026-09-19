import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Turns a Supabase/Postgres error into a sentence a person can act on, and logs the raw
 * error on the server so it shows up in Vercel logs.
 */
export function describeDbError(
  context: string,
  error: PostgrestError | { code?: string; message: string },
): string {
  console.error(`[db] ${context}:`, error.code ?? "", error.message);
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();

  if (code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache")) {
    return `${context}: the database tables have not been created yet. Run supabase/migrations/0001_initial_schema.sql and 0002_rls_policies.sql in the Supabase SQL editor.`;
  }
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return `${context}: the database refused the write (row-level security). Make sure 0002_rls_policies.sql has been applied and you are logged in.`;
  }
  if (code === "23505") return `${context}: that item already exists.`;
  if (code === "23514") return `${context}: a value failed a database check (${error.message}).`;
  if (code === "23503") return `${context}: a linked record no longer exists.`;
  return `${context}: ${error.message}`;
}
