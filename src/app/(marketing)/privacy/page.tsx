import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Placeholder">
      <p>
        This policy is a placeholder and will be replaced before launch. Your watchlists, scenarios,
        trades and reflections are private to your account. They are stored with row-level security
        so that no other user can read them.
      </p>
      <p>
        We do not sell personal data. Authentication is handled by Supabase; your password is never
        visible to us.
      </p>
    </LegalPage>
  );
}
