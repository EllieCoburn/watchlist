import { redirect } from "next/navigation";

/** The authenticated home is the Watch dashboard. */
export default function AppHomePage() {
  redirect("/app/watch");
}
