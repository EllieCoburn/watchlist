import { ButtonLink } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-start gap-5 py-10">
      <p className="label-caps text-muted">404</p>
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink">
        That is not here.
      </h1>
      <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">
        The trade or page you followed may have been deleted, or the link may be wrong.
      </p>
      <ButtonLink href="/app/trades" variant="secondary">
        Back to trades
      </ButtonLink>
    </div>
  );
}
