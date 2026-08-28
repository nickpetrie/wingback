import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

// Rendered on the server so the sign-in form is only ever sent to a browser
// that has already been established as signed out. Anyone arriving here with
// a live session — a bookmark, a back button, the PWA restoring its last
// screen — is bounced straight home instead of being shown a form that
// implies their season's login has evaporated.
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return <LoginForm />;
}
