import type { ReactNode } from "react";
import { Disclaimer } from "@/components/ui/disclaimer";
import { AppNav, MobileNav } from "./app-nav";

export function AppShell({
  accountLabel,
  children,
}: {
  accountLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav accountLabel={accountLabel} />
      <MobileNav accountLabel={accountLabel} />
      <main id="main" className="container-page flex-1 pt-6 pb-28 md:pt-10 md:pb-16">
        {children}
      </main>
      <footer className="container-page hidden py-6 md:block">
        <Disclaimer />
      </footer>
    </div>
  );
}
