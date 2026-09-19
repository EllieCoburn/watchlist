"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { updateDisplayName, type ProfileState } from "@/lib/actions/profile";

export function DisplayNameForm({ initialValue }: { initialValue: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateDisplayName, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.success ? <Notice tone="success">{state.success}</Notice> : null}
      <Field
        id="displayName"
        label="Display name"
        hint="Shown in the navigation. Leave blank to use your email."
      >
        <Input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={initialValue}
          maxLength={80}
          autoComplete="name"
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save name
        </SubmitButton>
      </div>
    </form>
  );
}
