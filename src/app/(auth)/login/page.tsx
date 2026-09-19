import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  "link-invalid": "That link is invalid or has expired. Please request a new one.",
  "not-configured": "Authentication is not configured for this environment yet.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your watchlists, scenarios and trade journal."
      footer={
        <p>
          New here?{" "}
          <Link href="/signup" className="text-ink underline underline-offset-4">
            Create a free account
          </Link>
        </p>
      }
    >
      <LoginForm
        next={next !== "/app" ? next : undefined}
        initialError={errorKey ? ERRORS[errorKey] : undefined}
      />
    </AuthCard>
  );
}
