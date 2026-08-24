import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { getGameweekFixtures } from "@/lib/fixtures";
import { getGameweekPicks } from "@/lib/picks";
import { getPickFormContext } from "@/lib/pick-form-context";
import { GameweekPicksPanel } from "../GameweekPicksPanel";
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

  const { data: doubleTeams } = gameweek
    ? await supabase.from("double_gameweek_teams").select("team").eq("event", gameweek.id)
    : { data: null };

  const pickForm = gameweek ? await getPickFormContext(supabase, entrantId, gameweek.id) : null;
  const fixtures = gameweek ? await getGameweekFixtures(supabase, gameweek.id) : [];
  const picks = gameweek ? await getGameweekPicks(supabase, gameweek.id) : [];

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-extrabold text-foreground">Your pick</h1>

      {!gameweek ? (
        <EmptyState>No gameweek data yet — check back once the season data has synced.</EmptyState>
      ) : gameweek.state === "unscheduled" ? (
        <EmptyState>
          Gameweek {gameweek.id} isn&rsquo;t scheduled yet — could be an international break, could just
          be early. Check back once fixtures are confirmed.
        </EmptyState>
      ) : (
        <>
          {gameweek.state === "open" && pickForm ? (
            <>
              {doubleTeams && doubleTeams.length > 0 && (
                <p className="mt-3 rounded-full bg-gold-500/15 px-4 py-2 text-sm font-medium text-gold-400">
                  ⭐ Double gameweek — {doubleTeams.length} team{doubleTeams.length > 1 ? "s" : ""} play twice.
                </p>
              )}

              <div className="mt-4">
                <PickForm
                  gameweek={gameweek.id}
                  players={pickForm.players}
                  usedCounts={pickForm.usedCounts}
                  nominationCode={pickForm.nominationCode}
                  doublesUsedCount={pickForm.doublesUsedCount}
                  currentPick={pickForm.currentPick}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-full bg-surface px-4 py-2 text-sm text-foreground/70">
              🔒 Gameweek {gameweek.id} has locked — no more picks until next gameweek.
            </p>
          )}

          <div className="mt-6">
            <GameweekPicksPanel fixtures={fixtures} picks={picks} />
          </div>
        </>
      )}
    </main>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-foreground/15 bg-surface p-6 text-center text-sm text-foreground/60">
      {children}
    </div>
  );
}
