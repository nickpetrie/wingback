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
    <main className="wb-in" style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "56px 24px 0" }}>
      <h1 style={{ margin: 0, fontSize: 44, letterSpacing: "-.03em" }}>Which one are you?</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
        Five names, five seasons of evidence. Claim yours.
      </p>
      <div style={{ marginTop: 28, borderTop: "2px solid var(--color-divider)" }}>
        <ClaimList profiles={profiles} />
      </div>
    </main>
  );
}
