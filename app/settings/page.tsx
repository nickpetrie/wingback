import { createClient } from "@/lib/supabase/server";
import { loadPlayers } from "@/lib/players";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { welcome } = await searchParams;

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

      {welcome === "1" && (
        <p className="mt-4 rounded-2xl bg-gold-500/15 px-4 py-3 text-sm text-gold-600">
          Welcome to Wingback! Pick a display name below — that&rsquo;s what the others will see on
          the leaderboard and revealed picks. You can also set your nominated player now, or later.
        </p>
      )}

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
