"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

/** Error boundary for public and auth pages. */
export default function RootError({
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
    <div className="flex flex-1 flex-col">
      <header className="container-page flex h-20 items-center">
        <Wordmark />
      </header>
      <main
        id="main"
        className="container-page flex flex-1 flex-col items-start justify-center gap-5 py-16"
        role="alert"
      >
        <p className="label-caps text-muted">Something went wrong</p>
        <h1 className="font-serif text-5xl leading-none tracking-tight text-ink">
          This page could not load.
        </h1>
        {error.digest ? (
          <p className="font-mono text-xs text-muted">Reference {error.digest}</p>
        ) : null}
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to the start
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
