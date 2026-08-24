import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { getGameweekFixtures } from "@/lib/fixtures";
import { getPickFormContext } from "@/lib/pick-form-context";
import { PickForm } from "./PickForm";

export default async function PickPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already redirects signed-out visitors

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // middleware sends anyone without a claim to /claim first

  const gameweek = await getCurrentGameweek(supabase);
  const fixtures = gameweek ? await getGameweekFixtures(supabase, gameweek.id) : [];
  const pickForm = gameweek?.state === "open" ? await getPickFormContext(supabase, entrantId, gameweek.id) : null;

  return (
    <main className="wb-in" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>
      <div style={{ borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
        <h1 style={{ margin: 0 }}>Make your pick</h1>
      </div>

      {!gameweek ? (
        <p style={{ marginTop: 24, fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          No gameweek data yet — check back once the season data has synced.
        </p>
      ) : !pickForm ? (
        <p style={{ marginTop: 24, fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          {gameweek.state === "locked"
            ? `Gameweek ${gameweek.id} has locked — no more picks until next gameweek.`
            : `Gameweek ${gameweek.id} isn't scheduled yet — could be an international break, could just be early.`}
        </p>
      ) : (
        <PickForm
          gameweek={gameweek.id}
          players={pickForm.players}
          fixtures={fixtures}
          usedCounts={pickForm.usedCounts}
          nominationCode={pickForm.nominationCode}
          doublesUsedCount={pickForm.doublesUsedCount}
          currentPick={pickForm.currentPick}
        />
      )}
    </main>
  );
}
