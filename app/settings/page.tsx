import { createClient } from "@/lib/supabase/server";
import { loadPlayers } from "@/lib/players";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id, display_name, phone, sms_opt_in, nomination_player_code")
    .eq("auth_user_id", user.id)
    .single();

  if (!entrant) return null; // middleware sends anyone without a claim to /claim first

  const players = await loadPlayers(supabase);
  const initialNomination = entrant.nomination_player_code
    ? players.find((p) => p.code === entrant.nomination_player_code) ?? null
    : null;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-extrabold text-foreground">Settings</h1>
      <div className="mt-4">
        <SettingsForm
          entrantId={entrant.id}
          displayName={entrant.display_name}
          initialPhone={entrant.phone ?? ""}
          initialSmsOptIn={entrant.sms_opt_in}
          players={players}
          initialNomination={initialNomination}
        />
      </div>
    </main>
  );
}
