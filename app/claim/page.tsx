import { createClient } from "@/lib/supabase/server";
import { getStarCounts } from "@/lib/winners";
import { ClaimList } from "./ClaimList";

export default async function ClaimPage() {
  const supabase = await createClient();

  const { data: entrants } = await supabase
    .from("entrants")
    .select("id, display_name, auth_user_id")
    .order("created_at", { ascending: true });

  const starCounts = await getStarCounts(supabase);

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
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">Which one are you?</h1>
        <p className="mt-1 text-sm text-foreground/50">Claim your profile to get started.</p>
      </div>
      <ClaimList profiles={profiles} />
    </main>
  );
}
