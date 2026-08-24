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
    .select("display_name, nomination_player_code")
    .eq("id", user.id)
    .single();

  const players = await loadPlayers(supabase);
  const initialNomination = entrant?.nomination_player_code
    ? players.find((p) => p.code === entrant.nomination_player_code) ?? null
    : null;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-extrabold text-pitch-900">Settings</h1>
      <div className="mt-4">
        <SettingsForm
          initialDisplayName={entrant?.display_name ?? ""}
          players={players}
          initialNomination={initialNomination}
        />
      </div>
    </main>
  );
}
