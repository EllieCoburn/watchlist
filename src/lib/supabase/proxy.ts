import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

const PROTECTED_PREFIX = "/app";
const AUTH_ONLY_ROUTES = new Set(["/login", "/signup", "/forgot-password"]);

/**
 * Refreshes the Supabase session cookie on every matched request and applies the
 * two redirect rules:
 *  - unauthenticated → /app/** goes to /login?next=…
 *  - authenticated → /login, /signup, /forgot-password goes to /app
 *
 * The /app layout re-verifies the user, so this is a fast path, not the only guard.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  const { pathname, search } = request.nextUrl;
  const isProtected = pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`);

  if (!env) {
    // Without Supabase there is no session; keep the app protected regardless.
    if (isProtected) return redirectToLogin(request, pathname + search);
    return response;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not put logic between createServerClient and getUser: the refresh must happen first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    return redirectToLogin(request, pathname + search);
  }

  if (user && AUTH_ONLY_ROUTES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

function redirectToLogin(request: NextRequest, next: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (next && next !== "/app") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
