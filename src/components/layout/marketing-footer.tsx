import Link from "next/link";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Wordmark } from "@/components/ui/wordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container-page flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Wordmark />
          <Disclaimer className="max-w-sm" />
        </div>
        <nav aria-label="Legal" className="flex gap-6 text-sm text-muted">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-ink">
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
