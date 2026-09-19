import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DisplayNameForm } from "@/components/settings/display-name-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { getProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);

  return (
    <div className="space-y-10">
      <PageHeader title="Settings" status={<p className="label-caps">Account</p>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-6">
          <div>
            <h2 className="font-serif text-2xl leading-tight text-ink">Profile</h2>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
          <DisplayNameForm initialValue={profile?.display_name ?? ""} />
        </Card>

        <Card className="space-y-6">
          <div>
            <h2 className="font-serif text-2xl leading-tight text-ink">Security</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              To change your password, request a reset link and follow it from your inbox.
            </p>
          </div>
          <Link href="/forgot-password" className="text-sm text-ink underline underline-offset-4">
            Send me a password reset link
          </Link>
          <div className="border-t border-border pt-6">
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                Log out
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
