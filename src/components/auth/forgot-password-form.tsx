"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";
import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  if (state.success) {
    return <Notice tone="success">{state.success}</Notice>;
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Field id="email" label="Email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>
      <div className="flex justify-end pt-1">
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </div>
    </form>
  );
}
