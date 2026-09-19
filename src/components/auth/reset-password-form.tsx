"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/auth";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Field
        id="password"
        label="New password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>
      <Field id="confirm" label="Confirm new password" error={state.fieldErrors?.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirm)}
        />
      </Field>
      <div className="flex justify-end pt-1">
        <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
      </div>
    </form>
  );
}
