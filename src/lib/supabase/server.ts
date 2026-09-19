import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getSupabaseEnv } from "./env";

/**
 * Server client for server components, route handlers and server actions.
 * Reads the session from cookies; writes refreshed cookies when allowed
 * (server actions and route handlers). In server components the write is a no-op,
 * which is fine because src/proxy.ts already refreshed the session for this request.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component: cookies are read-only here.
        }
      },
    },
  });
}

/**
 * The verified current user, or null. Uses getUser() (validated against the Auth server),
 * never getSession() alone. Returns null when Supabase is not configured so the app can
 * still render with a setup notice during local development.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!getSupabaseEnv()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
