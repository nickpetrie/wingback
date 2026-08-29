import { createClient, getSessionUser } from "@/lib/supabase/server";
import { loadPlayers } from "@/lib/players";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return null;

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id, display_name, phone, nomination_player_code")
    .eq("auth_user_id", user.id)
    .single();

  if (!entrant) return null; // middleware sends anyone without a claim to /claim first

  const initials = entrant.display_name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const players = await loadPlayers(supabase);
  const initialNomination = entrant.nomination_player_code
    ? players.find((p) => p.code === entrant.nomination_player_code) ?? null
    : null;

  return (
    <main className="wb-in" style={{ width: "100%", maxWidth: 480, margin: "0 auto", padding: "56px 24px 0" }}>
      <h1 style={{ margin: 0, fontSize: 38, letterSpacing: "-.02em" }}>Hi, {entrant.display_name}!</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
        A few quick steps before you&rsquo;re in.
      </p>
      <div style={{ marginTop: 24, borderTop: "2px solid var(--color-divider)", paddingTop: 24 }}>
        <OnboardingForm
          entrantId={entrant.id}
          initials={initials}
          initialPhone={entrant.phone ?? ""}
          players={players}
          initialNomination={initialNomination}
        />
      </div>
    </main>
  );
}
