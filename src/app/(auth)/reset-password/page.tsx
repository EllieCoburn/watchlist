import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Notice } from "@/components/ui/notice";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <AuthCard
      title="Choose a new password"
      description={user ? `Signed in as ${user.email}.` : undefined}
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Notice tone="info">
          This page only works from a password reset link.{" "}
          <Link href="/forgot-password" className="text-ink underline underline-offset-4">
            Request a new link
          </Link>
          .
        </Notice>
      )}
    </AuthCard>
  );
}
