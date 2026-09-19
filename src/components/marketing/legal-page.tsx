import type { ReactNode } from "react";
import { Disclaimer } from "@/components/ui/disclaimer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-16 md:py-24">
      <p className="label-caps text-muted">Last updated · {updated}</p>
      <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-ink md:text-5xl">
        {title}
      </h1>
      <div className="mt-8 space-y-5 text-[0.9375rem] leading-relaxed text-ink-secondary">
        {children}
      </div>
      <Disclaimer className="mt-12" />
    </article>
  );
}
