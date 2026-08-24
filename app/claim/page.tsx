import { createClient } from "@/lib/supabase/server";
import { ClaimList } from "./ClaimList";

export default async function ClaimPage() {
  const supabase = await createClient();

  const { data: entrants } = await supabase
    .from("entrants")
    .select("id, display_name, auth_user_id")
    .order("created_at", { ascending: true });

  const { data: winners } = await supabase.from("season_winners").select("entrant_id");
  const starCounts = new Map<string, number>();
  for (const w of winners ?? []) {
    starCounts.set(w.entrant_id, (starCounts.get(w.entrant_id) ?? 0) + 1);
  }

  const profiles = (entrants ?? []).map((e) => ({
    id: e.id,
    display_name: e.display_name,
    claimed: e.auth_user_id !== null,
    stars: starCounts.get(e.id) ?? 0,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-3xl">⚽</p>
        <h1 className="mt-2 text-2xl font-extrabold text-pitch-900">Which one are you?</h1>
        <p className="mt-1 text-sm text-pitch-900/50">Claim your profile to get started.</p>
      </div>
      <ClaimList profiles={profiles} />
    </main>
  );
}
