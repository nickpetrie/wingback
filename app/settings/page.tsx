import { createClient, getSessionUser } from "@/lib/supabase/server";
import { loadAlertPrefs } from "@/lib/alerts";
import { loadPlayers } from "@/lib/players";
import { AlertsForm } from "./AlertsForm";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return null;

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id, display_name, email, phone, nomination_player_code, avatar_updated_at")
    .eq("auth_user_id", user.id)
    .single();

  if (!entrant) return null; // middleware sends anyone without a claim to /claim first

  const [players, prefs, { data: config }] = await Promise.all([
    loadPlayers(supabase),
    loadAlertPrefs(supabase, entrant.id),
    supabase
      .from("season_config")
      .select("nominations_lock_after_gameweek, gameweeks(finished)")
      .maybeSingle(),
  ]);

  // The trigger in 20260101000026 is the enforcement; this only decides
  // whether the screen offers a Change button it knows would be refused.
  const lockGameweek = config?.nominations_lock_after_gameweek ?? null;
  const nominationsLocked = config?.gameweeks?.finished ?? false;
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
        nominationsLocked={nominationsLocked}
        lockGameweek={lockGameweek}
      />
    </main>
  );
}
