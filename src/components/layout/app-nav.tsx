"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Eye, FlaskConical, NotebookPen, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";

export const APP_SECTIONS = [
  { href: "/app/watch", label: "Watch", Icon: Eye },
  { href: "/app/simulate", label: "Simulate", Icon: FlaskConical },
  { href: "/app/trades", label: "Trades", Icon: NotebookPen },
  { href: "/app/analytics", label: "Analytics", Icon: BarChart3 },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Slim desktop top bar: wordmark, four text links, account link. Hidden on small screens. */
export function AppNav({ accountLabel }: { accountLabel: string }) {
  const isActive = useIsActive();
  const settingsActive = isActive("/app/settings");

  return (
    <header className="container-page hidden h-20 items-center justify-between md:flex">
      <div className="flex items-center gap-10">
        <Wordmark href="/app/watch" />
        <nav aria-label="Application" className="flex items-center gap-7 text-sm">
          {APP_SECTIONS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "border-b pb-0.5 transition-colors duration-150",
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Link
        href="/app/settings"
        aria-current={settingsActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
          settingsActive
            ? "border-ink text-ink"
            : "border-border text-muted hover:border-border-strong hover:text-ink",
        )}
      >
        <UserRound className="size-4" aria-hidden="true" />
        <span className="max-w-32 truncate">{accountLabel}</span>
      </Link>
    </header>
  );
}

/** Mobile: compact top row with wordmark + account, and a bottom tab bar for the four sections. */
export function MobileNav({ accountLabel }: { accountLabel: string }) {
  const isActive = useIsActive();

  return (
    <>
      <header className="container-page flex h-16 items-center justify-between md:hidden">
        <Wordmark href="/app/watch" />
        <Link
          href="/app/settings"
          aria-label={`Account: ${accountLabel}`}
          className="rounded-full border border-border p-2 text-muted"
        >
          <UserRound className="size-4" aria-hidden="true" />
        </Link>
      </header>
      <nav
        aria-label="Application"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4" role="list">
          {APP_SECTIONS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem]",
                    active ? "text-ink" : "text-muted",
                  )}
                >
                  <Icon
                    className="size-[18px]"
                    strokeWidth={active ? 2.25 : 1.75}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
