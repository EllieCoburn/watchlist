"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/auth";
import { SubmitButton } from "./submit-button";

export function SignupForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});

  if (state.success) {
    return <Notice tone="success">{state.success}</Notice>;
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field
        id="displayName"
        label="Name"
        hint="Optional. How we greet you."
        error={state.fieldErrors?.displayName}
      >
        <Input id="displayName" name="displayName" type="text" autoComplete="name" maxLength={80} />
      </Field>

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

      <Field
        id="password"
        label="Password"
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

      <Field id="confirm" label="Confirm password" error={state.fieldErrors?.confirm}>
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
        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </div>
    </form>
  );
}
