import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Placeholder">
      <p>
        These terms are a placeholder and will be replaced before launch. Watchlist is informational
        and journaling software. It does not execute trades, hold funds, or provide investment
        advice.
      </p>
      <p>
        You are responsible for the accuracy of the trades and scenarios you record. Market data may
        be delayed, modeled, or simulated, and should not be relied upon for trading decisions.
      </p>
    </LegalPage>
  );
}
