import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id, display_name, phone")
    .eq("auth_user_id", user.id)
    .single();

  if (!entrant) return null; // middleware sends anyone without a claim to /claim first

  const initials = entrant.display_name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-pitch-900">Hi, {entrant.display_name}!</h1>
        <p className="mt-1 text-sm text-pitch-900/50">A couple of optional extras.</p>
      </div>
      <OnboardingForm entrantId={entrant.id} initials={initials} initialPhone={entrant.phone ?? ""} />
    </main>
  );
}
