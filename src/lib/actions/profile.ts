"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { validateDisplayName } from "@/lib/validation/auth";

export type ProfileState = { error?: string; success?: string };

export async function updateDisplayName(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be logged in." };

  const displayName = validateDisplayName(formData.get("displayName"));
  if (displayName === null) return { error: "Keep your name under 80 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null })
    .eq("id", user.id);
  if (error) return { error: "Could not save your name. Please try again." };

  revalidatePath("/app", "layout");
  return { success: "Saved." };
}
