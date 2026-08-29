import { createClient } from "@/lib/supabase/server";
import { loadAlertPrefs } from "@/lib/alerts";
import { loadPlayers } from "@/lib/players";
import { AlertsForm } from "./AlertsForm";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id, display_name, email, phone, nomination_player_code, avatar_updated_at")
    .eq("auth_user_id", user.id)
    .single();

  if (!entrant) return null; // middleware sends anyone without a claim to /claim first

  const [players, prefs] = await Promise.all([
    loadPlayers(supabase),
    loadAlertPrefs(supabase, entrant.id),
  ]);
  const initialNomination = entrant.nomination_player_code
    ? (players.find((p) => p.code === entrant.nomination_player_code) ?? null)
    : null;

  return (
    <main className="wb-in" style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
      <div style={{ borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </div>
      <AlertsForm
        initialPrefs={prefs}
        initialPhone={entrant.phone ?? ""}
        email={entrant.email ?? user.email ?? null}
      />
      <SettingsForm
        entrantId={entrant.id}
        avatarUpdatedAt={entrant.avatar_updated_at}
        displayName={entrant.display_name}
        players={players}
        initialNomination={initialNomination}
      />
    </main>
  );
}
