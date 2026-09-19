"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { logIn, type AuthState } from "@/lib/actions/auth";
import { SubmitButton } from "./submit-button";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(logIn, {});
  const error = state.error ?? initialError;

  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Field id="email" label="Email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
      </Field>

      <Field id="password" label="Password" error={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
      </Field>

      <div className="flex items-center justify-between gap-4 pt-1">
        <Link
          href="/forgot-password"
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Forgot password?
        </Link>
        <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      </div>
    </form>
  );
}
