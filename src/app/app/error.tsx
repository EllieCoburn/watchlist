"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Error boundary for the authenticated app. Keeps the shell; offers a retry. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-5 py-10" role="alert">
      <p className="label-caps text-muted">Something went wrong</p>
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink">
        This page could not load.
      </h1>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">
        Your data is safe. Try again, and if it keeps happening, check that Supabase is reachable
        and the migrations have been applied.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted">Reference {error.digest}</p>
      ) : null}
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/app/watch" variant="secondary">
          Back to Watch
        </ButtonLink>
      </div>
    </div>
  );
}
