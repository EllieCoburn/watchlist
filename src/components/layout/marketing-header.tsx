import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#preview", label: "Preview" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingHeader() {
  return (
    <header className="container-page flex h-20 items-center justify-between">
      <Wordmark />
      <nav aria-label="Site" className="hidden items-center gap-8 text-sm text-muted md:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="transition-colors hover:text-ink">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="ghost" size="sm">
          Log in
        </ButtonLink>
        <ButtonLink href="/signup" size="sm">
          Create free account
        </ButtonLink>
      </div>
    </header>
  );
}
