import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="container-page flex h-20 items-center">
        <Wordmark />
      </header>
      <main
        id="main"
        className="container-page flex flex-1 flex-col items-start justify-center gap-6 py-16"
      >
        <p className="label-caps text-muted">404</p>
        <h1 className="font-serif text-5xl leading-none tracking-tight text-ink">
          That page is not here.
        </h1>
        <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">
          The link may be old, or the page may have moved.
        </p>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </main>
    </div>
  );
}
