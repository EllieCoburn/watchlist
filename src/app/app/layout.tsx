import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Every route under /app renders through here. The proxy already redirected anonymous
 * requests, but we verify again so a page can never render without a user.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  const accountLabel = profile?.display_name || user.email || "Account";

  return <AppShell accountLabel={accountLabel}>{children}</AppShell>;
}
