"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/utils";
import {
  MIN_PASSWORD_LENGTH,
  safeNextPath,
  validateDisplayName,
  validateEmail,
  validatePassword,
  type FieldErrors,
} from "@/lib/validation/auth";

export type AuthState = {
  error?: string;
  success?: string;
  fieldErrors?: FieldErrors<"email" | "password" | "confirm" | "displayName">;
  /** Set when the email exists but has not been confirmed, so the form can offer a resend. */
  unconfirmedEmail?: string;
};

const NOT_CONFIGURED: AuthState = {
  error:
    "Authentication is not configured yet. Add the Supabase environment variables and restart the app.",
};

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password combination was not found.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with that email already exists. Try logging in instead.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  return message;
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const email = validateEmail(formData.get("email"));
  const password =
    typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const fieldErrors: AuthState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (error) {
    const unconfirmed = error.message.toLowerCase().includes("email not confirmed");
    return {
      error: friendlyAuthError(error.message),
      unconfirmedEmail: unconfirmed ? email! : undefined,
    };
  }

  redirect(safeNextPath(formData.get("next")));
}

/** Re-sends the signup confirmation email for an unconfirmed account. */
export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const email = validateEmail(formData.get("email"));
  if (!email) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/app` },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { success: "Confirmation email sent. Check your inbox and spam folder." };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));
  const confirm =
    typeof formData.get("confirm") === "string" ? String(formData.get("confirm")) : "";
  const displayName = validateDisplayName(formData.get("displayName"));

  const fieldErrors: AuthState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password && confirm !== password) fieldErrors.confirm = "Passwords do not match.";
  if (displayName === null) fieldErrors.displayName = "Keep your name under 80 characters.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email!,
    password: password!,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/app`,
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };

  // Email confirmation disabled in the Supabase project → a session exists right away.
  if (data.session) redirect("/app");

  return {
    success: "Check your inbox. We sent a confirmation link to finish creating your account.",
  };
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const email = validateEmail(formData.get("email"));
  if (!email) return { fieldErrors: { email: "Enter a valid email address." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && !error.message.toLowerCase().includes("rate limit")) {
    // Do not reveal whether the address exists; log server-side only.
    console.error("resetPasswordForEmail failed", error.message);
  }
  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const password = validatePassword(formData.get("password"));
  const confirm =
    typeof formData.get("confirm") === "string" ? String(formData.get("confirm")) : "";
  const fieldErrors: AuthState["fieldErrors"] = {};
  if (!password) fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password && confirm !== password) fieldErrors.confirm = "Passwords do not match.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password! });
  if (error) return { error: friendlyAuthError(error.message) };

  redirect("/app?updated=password");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
